import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createToken, readJson, requireAuth, type AppEnv } from "../auth.js";
import { prisma } from "../db.js";
import { toUser } from "../mappers.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { RegisterInput, Session } from "../../src/types/index.js";
import { findMunicipio } from "../../src/utils/municipios.js";

export const authRoutes = new Hono<AppEnv>();

const required = (value: unknown) => typeof value === "string" && value.trim().length > 0;

async function newInviteCode(tx: Prisma.TransactionClient) {
  for (;;) {
    const code = String(100000 + Math.floor(Math.random() * 900000));
    if (!(await tx.patient.findUnique({ where: { inviteCode: code }, select: { id: true } }))) return code;
  }
}

authRoutes.post("/auth/login", async (c) => {
  const { email, password } = await readJson<{ email?: string; password?: string }>(c);
  const user = email ? await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } }) : null;
  if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HTTPException(401, { message: "E-mail ou senha incorretos." });
  }
  if (user.role === "pessoa") {
    throw new HTTPException(403, { message: "Esta conta é da pessoa cuidada. Use o aplicativo Acolhe no celular." });
  }
  return c.json<Session>({ token: await createToken(user), user: await toUser(user) });
});

authRoutes.post("/auth/register", async (c) => {
  const input = await readJson<RegisterInput>(c);
  if (![input.name, input.email, input.password].every(required) || input.password.length < 8) {
    throw new HTTPException(400, { message: "Preencha nome, e-mail e uma senha com pelo menos 8 caracteres." });
  }
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new HTTPException(409, { message: "Já existe uma conta com este e-mail." });
  }

  const name = input.name.trim();
  const base = { name, displayName: name.replace(/^Dr\.?a?\s+/i, "").split(" ")[0], email, passwordHash: await bcrypt.hash(input.password, 10) };

  const user = await prisma.$transaction(async (tx) => {
    if (input.role === "medico") {
      if (![input.crm, input.uf, input.specialty].every(required)) throw new HTTPException(400, { message: "Informe CRM, UF e especialidade." });
      return tx.user.create({
        data: { ...base, role: "medico", crm: input.crm.replace(/\D/g, ""), crmUf: input.uf.toUpperCase(), specialty: input.specialty },
      });
    }

    let patientId: string;
    if (input.patientCode) {
      const patient = await tx.patient.findUnique({ where: { inviteCode: input.patientCode }, select: { id: true } });
      if (!patient) throw new HTTPException(400, { message: "Código não encontrado. Confira os 6 números no app da pessoa cuidada." });
      patientId = patient.id;
    } else if (input.newPatient && required(input.newPatient.name)) {
      const { name: patientName, birthYear, city } = input.newPatient;
      const municipio = findMunicipio(city);
      patientId = (await tx.patient.create({
        data: {
          name: patientName.trim(), fullName: patientName.trim(), birthYear, inviteCode: await newInviteCode(tx),
          city: municipio?.label ?? city.trim(), cityIbgeCode: municipio?.ibgeCode,
        },
      })).id;
    } else {
      throw new HTTPException(400, { message: "Informe o código ou os dados da pessoa cuidada." });
    }

    const created = await tx.user.create({ data: { ...base, role: "cuidador", phone: input.phone || undefined } });
    const order = await tx.caregiver.count({ where: { patientId } });
    await tx.caregiver.create({
      data: {
        patientId, userId: created.id, name: base.displayName, relation: "Cuidador(a)", relationType: "familiar",
        phone: input.phone ?? "", order: order + 1, status: "ativo", level: "cuidador", channels: ["app", "whatsapp", "sms"],
        waitMinutes: 2, receivesAlerts: true, canViewHealth: true, canViewRoutine: true,
      },
    });
    await tx.caregiver.createMany({
      data: (input.supportContacts ?? []).filter((contact) => required(contact.name)).map((contact, i): Prisma.CaregiverCreateManyInput => ({
        patientId, name: contact.name.trim(), relation: "Contato de apoio", relationType: "outro", phone: contact.phone,
        order: order + 2 + i, status: "convite_pendente", level: "apoio", channels: ["whatsapp", "sms"],
        waitMinutes: 5, receivesAlerts: true, canViewHealth: false, canViewRoutine: false,
      })),
    });
    return created;
  });

  return c.json<Session>({ token: await createToken(user), user: await toUser(user) }, 201);
});

authRoutes.post("/auth/logout", requireAuth, (c) => c.body(null, 204));
