import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertPatientAccess, readJson, requireAuth, type AppEnv } from "../auth.js";
import { prisma } from "../db.js";
import { ensureDoses, ensureDosesFor } from "../doses.js";
import { careRulesOf, patientIdsOf, toCaregiver, toPatient, toPatients } from "../mappers.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { Caregiver, CareRules, InviteCaregiverInput } from "../../src/types/index.js";

export const patientRoutes = new Hono<AppEnv>();

// Pública (usada no cadastro): devolve só o necessário para confirmar a pessoa.
patientRoutes.get("/patients/by-code/:code", async (c) => {
  const patient = await prisma.patient.findUnique({ where: { inviteCode: c.req.param("code") } });
  if (!patient) return c.json(null);
  const { address: _a, phone: _p, attentionNote: _n, ...safe } = await toPatient(patient);
  return c.json({ ...safe, address: "" });
});

patientRoutes.get("/patients", requireAuth, async (c) => {
  const ids = await patientIdsOf(c.get("user"));
  await ensureDosesFor(ids);
  return c.json(await toPatients(await prisma.patient.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } })));
});

patientRoutes.get("/patients/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  await assertPatientAccess(c, id);
  await ensureDoses(id);
  return c.json(await toPatient(await prisma.patient.findUniqueOrThrow({ where: { id } })));
});

async function listCaregivers(patientId: string) {
  return (await prisma.caregiver.findMany({ where: { patientId }, orderBy: { order: "asc" } })).map(toCaregiver);
}

async function findCaregiver(c: Parameters<typeof assertPatientAccess>[0], id: string) {
  const caregiver = await prisma.caregiver.findUnique({ where: { id } });
  if (!caregiver) throw new HTTPException(404, { message: "Cuidador não encontrado." });
  await assertPatientAccess(c, caregiver.patientId);
  return caregiver;
}

patientRoutes.get("/patients/:id/caregivers", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  return c.json(await listCaregivers(patientId));
});

patientRoutes.post("/patients/:id/caregivers", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const { permissions, ...input } = await readJson<InviteCaregiverInput>(c);
  if (!input.name?.trim() || !input.phone?.trim()) throw new HTTPException(400, { message: "Informe nome e telefone." });
  const order = (await prisma.caregiver.count({ where: { patientId } })) + 1;
  const created = await prisma.caregiver.create({
    data: {
      patientId, order, status: "convite_pendente", name: input.name.trim(), phone: input.phone.trim(), relation: input.relation,
      relationType: input.relationType, level: input.level, channels: input.channels, waitMinutes: input.waitMinutes, ...permissions,
    },
  });
  return c.json(toCaregiver(created), 201);
});

patientRoutes.patch("/caregivers/:id", requireAuth, async (c) => {
  const caregiver = await findCaregiver(c, c.req.param("id"));
  const { permissions, name, relation, relationType, phone, order, status, level, channels, waitMinutes } =
    await readJson<Partial<Caregiver>>(c);
  const data: Prisma.CaregiverUpdateInput = { name, relation, relationType, phone, order, status, level, channels, waitMinutes, ...permissions };
  return c.json(toCaregiver(await prisma.caregiver.update({ where: { id: caregiver.id }, data })));
});

patientRoutes.put("/patients/:id/caregivers/order", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const { orderedIds = [] } = await readJson<{ orderedIds?: string[] }>(c);
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.caregiver.updateMany({ where: { id, patientId }, data: { order: i + 1 } })),
  );
  return c.json(await listCaregivers(patientId));
});

patientRoutes.delete("/caregivers/:id", requireAuth, async (c) => {
  const caregiver = await findCaregiver(c, c.req.param("id"));
  await prisma.caregiver.delete({ where: { id: caregiver.id } });
  return c.body(null, 204);
});

patientRoutes.get("/patients/:id/care-rules", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  return c.json(await careRulesOf(patientId));
});

patientRoutes.put("/patients/:id/care-rules", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const rules = await readJson<CareRules>(c);
  const settings = {
    remindersLevel: rules.levels.reminders, delaysLevel: rules.levels.delays, noActivityAlert: rules.noActivityAlert,
    noActivityHours: rules.noActivityHours, voiceReminders: rules.voiceReminders,
  };
  // Só aceita regras de remédios desta pessoa cuidada.
  const ownMedications = new Set((await prisma.medication.findMany({ where: { patientId }, select: { id: true } })).map((m) => m.id));
  await prisma.$transaction([
    prisma.careRules.upsert({ where: { patientId }, create: { patientId, ...settings }, update: settings }),
    ...rules.medications.filter((m) => ownMedications.has(m.medicationId)).map(({ medicationId, ...rule }) =>
      prisma.medicationRule.upsert({ where: { medicationId }, create: { medicationId, ...rule }, update: rule }),
    ),
  ]);
  return c.json(await careRulesOf(patientId));
});
