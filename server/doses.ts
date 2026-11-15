// Ao listar doses, cria as que faltam nos últimos 30 dias (horário de São Paulo, entre starts_at e ends_at).
// O back-end do app segue a mesma regra; a regra única (medication_id, scheduled_at) evita duplicar.
import { prisma } from "./db.js";
import { saoPauloDay } from "./mappers.js";

const WINDOW_DAYS = 30;
const DEFAULT_TOLERANCE = 30;

export async function ensureDoses(patientId: string) {
  const windowStart = saoPauloDay(-(WINDOW_DAYS - 1)).start;
  const medications = await prisma.medication.findMany({
    where: { patientId, times: { isEmpty: false }, OR: [{ endsAt: null }, { endsAt: { gt: windowStart } }] },
    include: { rule: { select: { toleranceMinutes: true } } },
  });
  if (!medications.length) return;

  const postponed = await prisma.medicationDose.findMany({
    where: { patientId, originalScheduledAt: { gte: windowStart } },
    select: { medicationId: true, originalScheduledAt: true },
  });
  const skip = new Set(postponed.map((d) => `${d.medicationId}|${d.originalScheduledAt!.getTime()}`));

  const now = Date.now();
  const missing = [];
  for (const m of medications) {
    const tolerance = (m.rule?.toleranceMinutes ?? DEFAULT_TOLERANCE) * 60_000;
    for (let offset = -(WINDOW_DAYS - 1); offset <= 0; offset++) {
      const dayStart = saoPauloDay(offset).start.getTime();
      for (const time of m.times) {
        const [hours, minutes] = time.split(":").map(Number);
        const scheduledAt = new Date(dayStart + (hours * 60 + minutes) * 60_000);
        if (scheduledAt < m.startsAt || (m.endsAt && scheduledAt >= m.endsAt) || skip.has(`${m.id}|${scheduledAt.getTime()}`)) continue;
        missing.push({
          medicationId: m.id, patientId, scheduledAt,
          status: scheduledAt.getTime() + tolerance < now ? "atrasado" as const : "pendente" as const,
        });
      }
    }
  }

  await prisma.medicationDose.createMany({ data: missing, skipDuplicates: true });
  await prisma.$transaction(medications.map((m) => prisma.medicationDose.updateMany({
    where: {
      medicationId: m.id, status: { in: ["pendente", "adiado"] },
      scheduledAt: { lt: new Date(now - (m.rule?.toleranceMinutes ?? DEFAULT_TOLERANCE) * 60_000) },
    },
    data: { status: "atrasado" },
  })));
}

export async function ensureDosesFor(patientIds: string[]) {
  await Promise.all(patientIds.map(ensureDoses));
}
