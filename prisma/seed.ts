/**
 * Popula o banco com os mesmos dados de demonstração dos mocks (src/mocks/db.ts),
 * mantendo os ids que o app mobile também usa (u-ana, p-maria, c-ana...).
 * Apaga tudo antes de inserir: rode só em desenvolvimento (`npm run db:seed`).
 */
import bcrypt from "bcryptjs";
import { prisma } from "../server/db.js";
import { saoPauloDay } from "../server/mappers.js";
import {
  alerts, appointments, caregivers, medications, doses, patients, prescriptions, timeline, users,
} from "@/mocks/db";

const SENHA_DEMO = "12345678";

/** Conta da pessoa cuidada, que só existe nos mocks do app mobile. */
const maria = { id: "u-maria", name: "Maria Aparecida Souza", displayName: "Dona Maria", email: "maria@exemplo.com" };

async function main() {
  const passwordHash = await bcrypt.hash(SENHA_DEMO, 10);
  const currentYear = new Date().getFullYear();

  await prisma.$transaction([
    prisma.medicationRule.deleteMany(),
    prisma.careRules.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.timelineEntry.deleteMany(),
    prisma.medicationDose.deleteMany(),
    prisma.medication.deleteMany(),
    prisma.alertRecipient.deleteMany(),
    prisma.emergencyAlert.deleteMany(),
    prisma.doctorPatient.deleteMany(),
    prisma.caregiver.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.user.createMany({
    data: [
      { ...maria, passwordHash, role: "pessoa", phone: "(11) 94444-0000", textSize: "grande", voiceReminders: true },
      ...users.map((u) => {
        const [, crm, crmUf] = u.crm?.match(/(\d+)-([A-Z]{2})/) ?? [];
        return {
          id: u.id, name: u.name, displayName: u.name.replace(/^Dr\.?a?\s+/, "").split(" ")[0], email: u.email,
          phone: u.phone, passwordHash, role: u.role === "medico" ? "medico" as const : "cuidador" as const,
          crm, crmUf, specialty: u.specialty ?? (u.role === "medico" ? "Clínica geral" : undefined),
        };
      }),
    ],
  });

  await prisma.patient.createMany({
    data: patients.map((p) => ({
      id: p.id, userId: p.id === "p-maria" ? maria.id : undefined, name: p.name, fullName: p.fullName,
      birthYear: currentYear - p.age, city: p.city, cityIbgeCode: p.cityIbgeCode, address: p.address,
      phone: p.phone, status: p.status, attentionNote: p.attentionNote, lastActivityAt: p.lastActivityAt,
      batteryLevel: p.batteryLevel, inviteCode: p.inviteCode ?? String(100000 + Math.floor(Math.random() * 900000)),
    })),
  });

  await prisma.caregiver.createMany({
    data: caregivers.map(({ initials: _i, permissions, ...c }) => ({
      ...c, ...permissions, userId: users.find((u) => u.role === "familiar" && u.name.startsWith(c.name))?.id,
    })),
  });

  await prisma.doctorPatient.createMany({
    data: users.filter((u) => u.role === "medico").flatMap((d) => d.patientIds.map((patientId) => ({ doctorId: d.id, patientId }))),
  });

  for (const { recipients, ...alert } of alerts) {
    await prisma.emergencyAlert.create({ data: { ...alert, recipients: { create: recipients } } });
  }

  // Remédios "começaram" há 30 dias, para a regra de doses (server/doses.ts) considerar o histórico todo.
  await prisma.medication.createMany({ data: medications.map(({ adherence30d: _a, ...m }) => ({ ...m, startsAt: saoPauloDay(-30).start })) });
  await prisma.medicationDose.createMany({ data: [...todayDoses(), ...doseHistory()] });
  await prisma.timelineEntry.createMany({ data: timeline });
  await prisma.appointment.createMany({ data: appointments.map(({ doctorName: _d, ...a }) => a) });

  for (const { doctorName: _n, doctorCrm: _c, items, ...rx } of prescriptions) {
    await prisma.prescription.create({
      data: { ...rx, items: { create: items.map((item, position) => ({ ...item, position })) } },
    });
  }

  console.log(`Banco populado. Contas de demonstração (senha ${SENHA_DEMO}): ${[maria.email, ...users.map((u) => u.email)].join(", ")}`);
}

/** Doses de hoje dos mocks, no horário de São Paulo (os mocks usam o fuso de quem roda o seed). */
function todayDoses() {
  return doses.map((d) => {
    const local = new Date(d.scheduledAt);
    return { ...d, scheduledAt: new Date(saoPauloDay(0).start.getTime() + (local.getHours() * 60 + local.getMinutes()) * 60_000) };
  });
}

/**
 * Doses dos últimos 30 dias (os mocks só têm as de hoje), para a adesão e os relatórios terem dados.
 * Cerca de 1 em 9 doses fica "atrasado" (não confirmada), de forma fixa para o resultado ser sempre igual.
 */
function doseHistory() {
  return medications.flatMap((m, medIndex) =>
    Array.from({ length: 29 }, (_, i) => i + 1).flatMap((daysAgo) =>
      m.times.map((time, timeIndex) => {
        const [hours, minutes] = time.split(":").map(Number);
        const missed = (daysAgo * 5 + timeIndex * 3 + medIndex * 7) % 9 === 0;
        return {
          medicationId: m.id,
          patientId: m.patientId,
          scheduledAt: new Date(saoPauloDay(-daysAgo).start.getTime() + (hours * 60 + minutes) * 60_000),
          status: missed ? "atrasado" as const : "tomado" as const,
          confirmedBy: missed ? undefined : patients.find((p) => p.id === m.patientId)?.name,
        };
      }),
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
