/**
 * Criação das doses a partir dos horários dos remédios.
 *
 * Regra (o back-end do app deve seguir a mesma, veja o README):
 * - Ao listar doses, adesão ou remédios, cria as doses que faltam dos últimos 30 dias até o fim de hoje,
 *   uma por remédio e horário (horário de São Paulo), entre medications.starts_at e medications.ends_at.
 * - A dose adiada não é recriada no horário original (medication_doses.original_scheduled_at).
 * - Dose "pendente" ou "adiado" que passou do horário mais a tolerância vira "atrasado".
 * A regra única (medication_id, scheduled_at) impede duplicar se os dois back-ends criarem ao mesmo tempo.
 */
import { prisma } from "./db.js";
import { saoPauloDay } from "./mappers.js";

const WINDOW_DAYS = 30;
/** Minutos sem confirmação até a dose contar como atrasada (o padrão das regras de cuidado). */
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
