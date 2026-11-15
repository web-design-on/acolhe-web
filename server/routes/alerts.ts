import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertPatientAccess, readJson, requireAuth, type AppEnv } from "../auth.js";
import { prisma } from "../db.js";
import { alertInclude, toAlert, toCaregiver, toPatient } from "../mappers.js";
import type { AlertContext } from "../../src/types/index.js";

// /alerts/:id é público (link do WhatsApp/SMS); o id longo e aleatório funciona como chave.
export const alertRoutes = new Hono<AppEnv>();

const ACTIVE = ["enviado", "assumido"] as const;
const DEMO_ID = "a-demo";

// "demo" recria o alerta de demonstração quando o anterior foi encerrado.
async function resolveAlertId(id: string) {
  if (id !== "demo") return id;
  const existing = await prisma.emergencyAlert.findUnique({ where: { id: DEMO_ID } });
  if (existing && (ACTIVE as readonly string[]).includes(existing.status)) return DEMO_ID;
  if (existing) await prisma.emergencyAlert.delete({ where: { id: DEMO_ID } });

  const caregivers = await prisma.caregiver.findMany({ where: { id: { in: ["c-ana", "c-carlos", "c-beatriz"] } } });
  if (!caregivers.length) throw new HTTPException(404, { message: "Alerta de demonstração indisponível (rode npm run db:seed)." });
  const channels = { "c-ana": ["sms", ["app", "whatsapp"]], "c-carlos": ["whatsapp", ["app"]], "c-beatriz": ["whatsapp", []] } as const;
  await prisma.emergencyAlert.create({
    data: {
      id: DEMO_ID, patientId: "p-maria", createdAt: new Date(Date.now() - 3 * 60_000), triggeredBy: "Dona Maria",
      location: "Rua das Flores, 120 - São Paulo, SP",
      recipients: {
        create: caregivers.map((c) => {
          const [channel, failed] = channels[c.id as keyof typeof channels];
          return { caregiverId: c.id, channel, failedChannels: [...failed] };
        }),
      },
    },
  });
  return DEMO_ID;
}

async function findAlert(id: string) {
  const alert = await prisma.emergencyAlert.findUnique({ where: { id: await resolveAlertId(id) }, include: alertInclude });
  if (!alert) throw new HTTPException(404, { message: "Este alerta não existe ou já foi encerrado." });
  return alert;
}

function assertActive(status: string) {
  if (!(ACTIVE as readonly string[]).includes(status)) throw new HTTPException(409, { message: "Este alerta já foi encerrado." });
}

alertRoutes.get("/patients/:id/alerts", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const list = await prisma.emergencyAlert.findMany({ where: { patientId }, include: alertInclude, orderBy: { createdAt: "desc" } });
  return c.json(list.map(toAlert));
});

alertRoutes.get("/patients/:id/alerts/active", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const alert = await prisma.emergencyAlert.findFirst({
    where: { patientId, status: { in: [...ACTIVE] } }, include: alertInclude, orderBy: { createdAt: "desc" },
  });
  return c.json(alert ? toAlert(alert) : null);
});

alertRoutes.get("/alerts/:id", async (c) => c.json(toAlert(await findAlert(c.req.param("id")))));

// Sem telefones da rede nem código de convite: a rota é pública.
alertRoutes.get("/alerts/:id/context", async (c) => {
  const alert = await findAlert(c.req.param("id"));
  const [patient, caregivers] = await Promise.all([
    prisma.patient.findUniqueOrThrow({ where: { id: alert.patientId } }),
    prisma.caregiver.findMany({ where: { patientId: alert.patientId }, orderBy: { order: "asc" } }),
  ]);
  const { inviteCode: _code, attentionNote: _note, ...safePatient } = await toPatient(patient);
  return c.json<AlertContext>({
    patient: safePatient,
    caregivers: caregivers.map((cg) => ({ ...toCaregiver(cg), phone: "" })),
  });
});

alertRoutes.post("/alerts/:id/respond", async (c) => {
  const alert = await findAlert(c.req.param("id"));
  assertActive(alert.status);
  const { caregiverId, status } = await readJson<{ caregiverId?: string; status?: "assumiu" | "recusou" }>(c);
  if (!caregiverId || (status !== "assumiu" && status !== "recusou")) throw new HTTPException(400, { message: "Resposta inválida." });
  const caregiver = await prisma.caregiver.findFirst({ where: { id: caregiverId, patientId: alert.patientId } });
  if (!caregiver) throw new HTTPException(404, { message: "Você não está na rede de cuidado desta pessoa." });

  const takesOver = status === "assumiu" && alert.status === "enviado";
  await prisma.$transaction([
    prisma.alertRecipient.upsert({
      where: { alertId_caregiverId: { alertId: alert.id, caregiverId } },
      create: { alertId: alert.id, caregiverId, status },
      update: { status },
    }),
    ...(takesOver
      ? [prisma.emergencyAlert.update({
          where: { id: alert.id },
          data: {
            status: "assumido", assumedByCaregiverId: caregiverId,
            responseTimeSeconds: Math.max(1, Math.round((Date.now() - alert.createdAt.getTime()) / 1000)),
          },
        })]
      : []),
  ]);
  return c.json(toAlert(await findAlert(alert.id)));
});

alertRoutes.post("/alerts/:id/resolve", async (c) => {
  const alert = await findAlert(c.req.param("id"));
  assertActive(alert.status);
  const { resultNote = "Tudo bem" } = await readJson<{ resultNote?: string }>(c);
  await prisma.emergencyAlert.update({
    where: { id: alert.id }, data: { status: "resolvido", resolvedAt: new Date(), resultNote: resultNote.slice(0, 500) },
  });
  return c.json(toAlert(await findAlert(alert.id)));
});
