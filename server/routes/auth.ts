import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createToken, readJson, requireAuth, type AppEnv } from "../auth.js";
import { prisma } from "../db.js";
import { toUser } from "../mappers.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { RegisterInput, Session, UpdateAccountInput } from "../../src/types/index.js";
import { findMunicipio } from "../../src/utils/municipios.js";

export const authRoutes = new Hono<AppEnv>();

const required = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const TEXT_SIZES = ["normal", "grande", "muito_grande"] as const;
const VOICE_VOLUMES = ["baixo", "medio", "alto"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function newInviteCode(tx: Prisma.TransactionClient) {
  for (;;) {
    const code = String(100000 + Math.floor(Math.random() * 900000));
    if (!(await tx.patient.findUnique({ where: { inviteCode: code }, select: { id: true } }))) return code;
  }
}

const phoneDigits = (phone: string) => phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

// O celular é gravado como foi digitado ("(11) 94444-0000"), então a busca compara só os dígitos.
async function findUserIdByPhone(phone: string) {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE regexp_replace(phone, '\\D', '', 'g') = ${digits} LIMIT 1`;
  return rows[0]?.id ?? null;
}

// Cada cliente decide quais perfis aceita: o portal recusa a pessoa cuidada, o app recusa o médico.
authRoutes.post("/auth/login", async (c) => {
  const { email, login, password } = await readJson<{ email?: string; login?: string; password?: string }>(c);
  const identifier = (login ?? email ?? "").trim().toLowerCase();
  const user = !identifier
    ? null
    : identifier.includes("@")
      ? await prisma.user.findUnique({ where: { email: identifier } })
      : await findUserIdByPhone(identifier).then((id) => (id ? prisma.user.findUnique({ where: { id } }) : null));
  if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HTTPException(401, { message: "E-mail/celular ou senha incorretos." });
  }
  return c.json<Session>({ token: await createToken(user), user: await toUser(user) });
});

authRoutes.get("/auth/me", requireAuth, async (c) => c.json(await toUser(c.get("user"))));

// A própria pessoa muda e-mail, celular e preferências. O celular novo também vale para os alertas:
// atualiza o cadastro da pessoa cuidada (se for ela) e os vínculos de cuidador (se for da rede).
authRoutes.patch("/auth/me", requireAuth, async (c) => {
  const user = c.get("user");
  const input = await readJson<UpdateAccountInput>(c);
  const data: Prisma.UserUpdateInput = {};

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HTTPException(400, { message: "Confira o e-mail digitado." });
    if (email !== user.email) {
      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
        throw new HTTPException(409, { message: "Já existe uma conta com este e-mail." });
      }
      data.email = email;
    }
  }

  let phone: string | undefined;
  if (input.phone !== undefined) {
    phone = input.phone.trim();
    if (phoneDigits(phone).length < 10) throw new HTTPException(400, { message: "Informe o celular com DDD." });
    const owner = await findUserIdByPhone(phone);
    if (owner && owner !== user.id) throw new HTTPException(409, { message: "Já existe uma conta com este celular." });
    data.phone = phone;
  }

  if (input.accessibility) {
    if (user.role !== "pessoa") throw new HTTPException(400, { message: "Preferências de leitura são da pessoa cuidada." });
    const { textSize, voiceReminders, voiceVolume } = input.accessibility;
    if (textSize !== undefined) {
      if (!TEXT_SIZES.includes(textSize)) throw new HTTPException(400, { message: "Tamanho de texto inválido." });
      data.textSize = textSize;
    }
    if (voiceVolume !== undefined) {
      if (!VOICE_VOLUMES.includes(voiceVolume)) throw new HTTPException(400, { message: "Volume inválido." });
      data.voiceVolume = voiceVolume;
    }
    if (voiceReminders !== undefined) data.voiceReminders = Boolean(voiceReminders);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.user.update({ where: { id: user.id }, data });
    if (phone) {
      if (user.role === "pessoa") await tx.patient.updateMany({ where: { userId: user.id }, data: { phone } });
      if (user.role === "cuidador") await tx.caregiver.updateMany({ where: { userId: user.id }, data: { phone } });
    }
    return saved;
  });
  return c.json(await toUser(updated));
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
  // O celular é único no banco: sem esta checagem, um número repetido virava erro 500.
  const phone = input.role !== "medico" && required(input.phone) ? input.phone.trim() : undefined;
  if (phone && (await findUserIdByPhone(phone))) {
    throw new HTTPException(409, { message: "Já existe uma conta com este celular." });
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

    if (input.role === "pessoa") {
      const { textSize, voiceReminders, voiceVolume } = input.accessibility ?? {};
      const created = await tx.user.create({
        data: {
          ...base, role: "pessoa", phone,
          textSize: textSize && TEXT_SIZES.includes(textSize) ? textSize : "normal",
          voiceReminders: voiceReminders ?? true,
          voiceVolume: voiceVolume && VOICE_VOLUMES.includes(voiceVolume) ? voiceVolume : "alto",
        },
      });
      if (input.patientCode) {
        const patient = await tx.patient.findUnique({ where: { inviteCode: input.patientCode }, select: { id: true, userId: true, phone: true } });
        if (!patient) throw new HTTPException(400, { message: "Código não encontrado. Confira os 6 números com quem cuida de você." });
        if (patient.userId) throw new HTTPException(409, { message: "Esta pessoa já tem uma conta no Acolhe. Entre com o e-mail dela." });
        await tx.patient.update({ where: { id: patient.id }, data: { userId: created.id, phone: patient.phone ?? phone } });
      } else if (input.newPatient && required(input.newPatient.city)) {
        const { birthYear, city } = input.newPatient;
        const municipio = findMunicipio(city);
        await tx.patient.create({
          data: {
            userId: created.id, name, fullName: name, birthYear, phone, inviteCode: await newInviteCode(tx),
            city: municipio?.label ?? city.trim(), cityIbgeCode: municipio?.ibgeCode,
          },
        });
      } else {
        throw new HTTPException(400, { message: "Informe o código de quem cuida de você ou o seu ano de nascimento e cidade." });
      }
      return created;
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

    const created = await tx.user.create({ data: { ...base, role: "cuidador", phone } });
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
