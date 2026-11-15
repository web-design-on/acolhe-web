import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertDoctor, assertPatientAccess, readJson, requireAuth, type AppEnv } from "../auth.js";
import { prisma } from "../db.js";
import { ensureDoses } from "../doses.js";
import {
  adherenceSummary, saoPauloDay, toAppointment, toDose, toMedications, toPrescription, toTimelineEntry,
} from "../mappers.js";
import type { CreateNoteInput, CreatePrescriptionInput } from "../../src/types/index.js";
import { durationDays, parseTimes, timesForFrequency } from "../../src/utils/doseTimes.js";
import { findSusMedication } from "../../src/utils/susCatalog.js";

export const careRoutes = new Hono<AppEnv>();

careRoutes.get("/patients/:id/medications", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  await ensureDoses(patientId);
  const medications = await prisma.medication.findMany({
    where: { patientId, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, orderBy: { createdAt: "asc" },
  });
  return c.json(await toMedications(medications));
});

careRoutes.get("/patients/:id/doses", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  await ensureDoses(patientId);
  const { start, end } = saoPauloDay();
  const doses = await prisma.medicationDose.findMany({
    where: { patientId, scheduledAt: { gte: start, lt: end } }, orderBy: { scheduledAt: "asc" },
  });
  return c.json(doses.map(toDose));
});

careRoutes.get("/patients/:id/adherence", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const days = Math.min(Math.max(Number(c.req.query("days")) || 30, 1), 365);
  await ensureDoses(patientId);
  return c.json(await adherenceSummary(patientId, days));
});

careRoutes.get("/patients/:id/timeline", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const limit = Number(c.req.query("limit")) || undefined;
  const entries = await prisma.timelineEntry.findMany({ where: { patientId }, orderBy: { at: "desc" }, take: limit });
  return c.json(entries.map(toTimelineEntry));
});

careRoutes.post("/patients/:id/timeline", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const { title, description = "", type, warn = false } = await readJson<CreateNoteInput>(c);
  if (!title?.trim()) throw new HTTPException(400, { message: "Escreva um título para a anotação." });
  const user = c.get("user");
  const entry = await prisma.timelineEntry.create({
    data: { patientId, title: title.trim(), description, type, warn, authorName: user.displayName, authorUserId: user.id },
  });
  return c.json(toTimelineEntry(entry), 201);
});

careRoutes.get("/patients/:id/appointments", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const list = await prisma.appointment.findMany({ where: { patientId }, include: { doctor: true }, orderBy: { at: "asc" } });
  return c.json(list.map(toAppointment));
});

careRoutes.get("/doctors/:id/appointments", requireAuth, async (c) => {
  assertDoctor(c);
  if (c.req.param("id") !== c.get("user").id) throw new HTTPException(403, { message: "Você só pode ver a sua agenda." });
  const list = await prisma.appointment.findMany({ where: { doctorId: c.get("user").id }, include: { doctor: true }, orderBy: { at: "asc" } });
  return c.json(list.map(toAppointment));
});

const prescriptionInclude = { doctor: true, items: true } as const;

careRoutes.get("/patients/:id/prescriptions", requireAuth, async (c) => {
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const list = await prisma.prescription.findMany({ where: { patientId }, include: prescriptionInclude, orderBy: { issuedAt: "desc" } });
  return c.json(list.map(toPrescription));
});

careRoutes.post("/patients/:id/prescriptions", requireAuth, async (c) => {
  assertDoctor(c);
  const patientId = c.req.param("id");
  await assertPatientAccess(c, patientId);
  const { items = [], instructions = "" } = await readJson<CreatePrescriptionInput>(c);
  if (!items.length || items.some((item) => !item.medication?.trim())) {
    throw new HTTPException(400, { message: "Adicione pelo menos um remédio à receita." });
  }
  const now = new Date();
  const rows = items.map((item) => ({
    ...item,
    medication: item.medication.trim(),
    catmatCode: item.catmatCode ?? findSusMedication(item.medication, item.dose)?.catmatCode,
    times: item.times?.length ? parseTimes(item.times.join(",")) : timesForFrequency(item.frequency),
    days: durationDays(item.duration),
  }));

  const created = await prisma.$transaction(async (tx) => {
    const rx = await tx.prescription.create({
      data: {
        patientId,
        doctorId: c.get("user").id,
        title: rows.length > 1 ? "Receita" : `Receita de ${rows[0].medication}`,
        instructions,
        signed: true,
        items: {
          create: rows.map((item, position) => ({
            position, medication: item.medication, dose: item.dose, frequency: item.frequency, duration: item.duration,
            suggestConfirmation: item.suggestConfirmation ?? false, catmatCode: item.catmatCode,
          })),
        },
      },
      include: prescriptionInclude,
    });
    for (const item of rows) {
      await tx.medication.create({
        data: {
          patientId, prescriptionId: rx.id, name: item.medication, dose: item.dose, frequency: item.frequency,
          instructions, times: item.times, continuousUse: item.days === undefined, catmatCode: item.catmatCode,
          startsAt: now, endsAt: item.days === undefined ? undefined : new Date(now.getTime() + item.days * 24 * 60 * 60_000),
          rule: { create: { requiresConfirmation: item.suggestConfirmation ?? true } },
        },
      });
    }
    return rx;
  });
  return c.json(toPrescription(created), 201);
});
