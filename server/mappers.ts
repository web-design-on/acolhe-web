import { prisma } from "./db.js";
import type * as Db from "./generated/prisma/client.js";
import type {
  AdherenceSummary, Appointment, Caregiver, CareRules, EmergencyAlert, Medication, MedicationDose, Patient,
  Prescription, TimelineEntry, User,
} from "../src/types/index.js";
import { findSusMedication } from "../src/utils/susCatalog.js";
import { getInitials } from "../src/utils/text.js";

const opt = <T>(value: T | null) => value ?? undefined;
const iso = (date: Date) => date.toISOString();
const DAY = 24 * 60 * 60_000;

// São Paulo: UTC-3, sem horário de verão.

const SP_OFFSET = 3 * 60 * 60_000;

export function saoPauloDay(offsetDays = 0) {
  const sp = new Date(Date.now() - SP_OFFSET);
  const start = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + offsetDays) + SP_OFFSET);
  return { start, end: new Date(start.getTime() + DAY) };
}

const percent = (taken: number, scheduled: number) => (scheduled ? Math.round((taken / scheduled) * 100) : 100);

// Sem doses previstas conta como 100% (nada foi perdido).
async function adherenceBy(by: "patientId" | "medicationId", ids: string[], days = 30) {
  const groups = await prisma.medicationDose.groupBy({
    by: [by, "status"],
    where: { [by]: { in: ids }, scheduledAt: { gte: new Date(Date.now() - days * DAY), lte: new Date() } },
    _count: true,
  });
  return new Map(ids.map((id) => {
    const mine = groups.filter((g) => g[by] === id);
    const scheduled = mine.reduce((sum, g) => sum + g._count, 0);
    const taken = mine.find((g) => g.status === "tomado")?._count ?? 0;
    return [id, percent(taken, scheduled)];
  }));
}

export async function adherenceSummary(patientId: string, days: number): Promise<AdherenceSummary> {
  const since = saoPauloDay(-(days - 1)).start;
  const [doses, notes] = await Promise.all([
    prisma.medicationDose.findMany({ where: { patientId, scheduledAt: { gte: since, lte: new Date() } }, select: { scheduledAt: true, status: true } }),
    prisma.timelineEntry.count({ where: { patientId, at: { gte: since }, type: { in: ["anotacao", "sintoma"] } } }),
  ]);
  const daily = Array.from({ length: days }, (_, i) => {
    const { start, end } = saoPauloDay(i - (days - 1));
    const ofDay = doses.filter((d) => d.scheduledAt >= start && d.scheduledAt < end);
    return { date: iso(new Date(start.getTime() + 12 * 60 * 60_000)), percent: percent(ofDay.filter((d) => d.status === "tomado").length, ofDay.length) };
  });
  return {
    patientId,
    periodDays: days,
    taken: doses.filter((d) => d.status === "tomado").length,
    scheduled: doses.length,
    late: doses.filter((d) => d.status === "atrasado").length,
    notes,
    daily,
  };
}

export async function patientIdsOf(user: Db.User) {
  if (user.role === "medico") {
    return (await prisma.doctorPatient.findMany({ where: { doctorId: user.id }, select: { patientId: true } })).map((d) => d.patientId);
  }
  if (user.role === "cuidador") {
    return (await prisma.caregiver.findMany({ where: { userId: user.id }, select: { patientId: true } })).map((c) => c.patientId);
  }
  return (await prisma.patient.findMany({ where: { userId: user.id }, select: { id: true } })).map((p) => p.id);
}

export async function toUser(user: Db.User): Promise<User> {
  const caregiverLinks = user.role === "cuidador"
    ? (await prisma.caregiver.findMany({ where: { userId: user.id }, select: { id: true, patientId: true }, orderBy: { createdAt: "asc" } }))
        .map((c) => ({ patientId: c.patientId, caregiverId: c.id }))
    : undefined;
  return {
    id: user.id,
    name: user.name,
    initials: getInitials(user.name),
    email: user.email,
    role: user.role === "medico" ? "medico" : "familiar",
    crm: user.crm ? `CRM ${user.crm}-${user.crmUf}` : undefined,
    patientIds: caregiverLinks ? caregiverLinks.map((link) => link.patientId) : await patientIdsOf(user),
    phone: opt(user.phone),
    specialty: opt(user.specialty),
    accountRole: user.role,
    displayName: user.displayName,
    caregiverLinks,
    accessibility: user.role === "pessoa"
      ? { textSize: user.textSize ?? "normal", voiceReminders: user.voiceReminders ?? true }
      : undefined,
  };
}

export async function toPatients(patients: Db.Patient[]): Promise<Patient[]> {
  const adherence = await adherenceBy("patientId", patients.map((p) => p.id));
  const year = new Date().getFullYear();
  return patients.map((p) => ({
    id: p.id,
    name: p.name,
    fullName: p.fullName,
    initials: getInitials(p.fullName),
    age: p.birthYear ? year - p.birthYear : 0,
    city: p.city,
    cityIbgeCode: opt(p.cityIbgeCode),
    address: p.address,
    status: p.status,
    attentionNote: opt(p.attentionNote),
    lastActivityAt: iso(p.lastActivityAt ?? p.createdAt),
    batteryLevel: p.batteryLevel ?? 0,
    adherence30d: adherence.get(p.id) ?? 100,
    inviteCode: p.inviteCode,
    phone: opt(p.phone),
  }));
}

export async function toPatient(patient: Db.Patient) {
  return (await toPatients([patient]))[0];
}

export function toCaregiver(c: Db.Caregiver): Caregiver {
  return {
    id: c.id,
    patientId: c.patientId,
    name: c.name,
    initials: getInitials(c.name),
    relation: c.relation,
    relationType: c.relationType,
    phone: c.phone,
    order: c.order,
    status: c.status,
    permissions: { receivesAlerts: c.receivesAlerts, canViewHealth: c.canViewHealth, canViewRoutine: c.canViewRoutine },
    level: c.level,
    channels: c.channels,
    waitMinutes: c.waitMinutes,
  };
}

export const alertInclude = { recipients: { include: { caregiver: { select: { order: true } } } } } as const;
type AlertRow = Db.Prisma.EmergencyAlertGetPayload<{ include: typeof alertInclude }>;

export function toAlert(a: AlertRow): EmergencyAlert {
  return {
    id: a.id,
    patientId: a.patientId,
    createdAt: iso(a.createdAt),
    triggeredBy: a.triggeredBy,
    status: a.status,
    recipients: [...a.recipients]
      .sort((x, y) => x.caregiver.order - y.caregiver.order)
      .map((r) => ({
        caregiverId: r.caregiverId, status: r.status, updatedAt: iso(r.updatedAt),
        channel: opt(r.channel), failedChannels: r.failedChannels.length ? r.failedChannels : undefined,
      })),
    assumedByCaregiverId: opt(a.assumedByCaregiverId),
    responseTimeSeconds: opt(a.responseTimeSeconds),
    resolvedAt: a.resolvedAt ? iso(a.resolvedAt) : undefined,
    resultNote: opt(a.resultNote),
    offline: a.offline,
    location: opt(a.location),
  };
}

export async function toMedications(medications: Db.Medication[]): Promise<Medication[]> {
  const adherence = await adherenceBy("medicationId", medications.map((m) => m.id));
  return medications.map((m) => ({
    id: m.id, patientId: m.patientId, name: m.name, dose: m.dose, frequency: m.frequency, instructions: m.instructions,
    times: m.times, continuousUse: m.continuousUse, adherence30d: adherence.get(m.id) ?? 100,
  }));
}

export function toDose(d: Db.MedicationDose): MedicationDose {
  return {
    id: d.id, medicationId: d.medicationId, patientId: d.patientId, scheduledAt: iso(d.scheduledAt),
    status: d.status, confirmedBy: opt(d.confirmedBy),
  };
}

export function toTimelineEntry(t: Db.TimelineEntry): TimelineEntry {
  return {
    id: t.id, patientId: t.patientId, at: iso(t.at), type: t.type, title: t.title, description: t.description,
    authorName: t.authorName, warn: t.warn || undefined,
  };
}

type WithDoctor<T> = T & { doctor: Db.User };

export function toAppointment(a: WithDoctor<Db.Appointment>): Appointment {
  return {
    id: a.id, patientId: a.patientId, doctorId: a.doctorId, doctorName: a.doctor.name, specialty: a.specialty,
    at: iso(a.at), durationMinutes: a.durationMinutes, mode: a.mode, location: opt(a.location),
  };
}

export function toPrescription(rx: WithDoctor<Db.Prescription> & { items: Db.PrescriptionItem[] }): Prescription {
  return {
    id: rx.id,
    patientId: rx.patientId,
    doctorId: rx.doctorId,
    doctorName: rx.doctor.name,
    doctorCrm: rx.doctor.crm ? `CRM ${rx.doctor.crm}-${rx.doctor.crmUf}` : "",
    issuedAt: iso(rx.issuedAt),
    title: rx.title,
    items: [...rx.items].sort((a, b) => a.position - b.position).map((item) => ({
      medication: item.medication, dose: item.dose, frequency: item.frequency, duration: item.duration,
      suggestConfirmation: item.suggestConfirmation || undefined,
      // Receitas antigas, sem código, ganham o código na leitura.
      catmatCode: item.catmatCode ?? findSusMedication(item.medication, item.dose)?.catmatCode,
    })),
    instructions: rx.instructions,
    status: rx.status,
    signed: rx.signed,
  };
}

export async function careRulesOf(patientId: string): Promise<CareRules> {
  const [rules, medications] = await Promise.all([
    prisma.careRules.findUnique({ where: { patientId } }),
    prisma.medication.findMany({
      where: { patientId, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, include: { rule: true }, orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    patientId,
    medications: medications.map((m) => ({
      medicationId: m.id,
      requiresConfirmation: m.rule?.requiresConfirmation ?? true,
      toleranceMinutes: m.rule?.toleranceMinutes ?? 30,
      notifyWho: m.rule?.notifyWho ?? "principal",
      repeatReminder: m.rule?.repeatReminder ?? true,
    })),
    levels: { reminders: rules?.remindersLevel ?? "normal", delays: rules?.delaysLevel ?? "urgente" },
    noActivityAlert: rules?.noActivityAlert ?? false,
    noActivityHours: rules?.noActivityHours ?? 12,
    voiceReminders: rules?.voiceReminders ?? true,
  };
}
