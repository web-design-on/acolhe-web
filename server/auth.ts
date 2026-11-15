import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "./db.js";
import type { User } from "./generated/prisma/client.js";

export type AppEnv = { Variables: { user: User } };

const TOKEN_DAYS = 30;

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET não configurado (veja .env.example)");
  return new TextEncoder().encode(value);
}

export async function createToken(user: User) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_DAYS}d`)
    .sign(secret());
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HTTPException(401, { message: "Faça login para continuar." });
  let userId: string | undefined;
  try {
    userId = (await jwtVerify(token, secret())).payload.sub;
  } catch {
    throw new HTTPException(401, { message: "Sua sessão expirou. Entre de novo." });
  }
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user) throw new HTTPException(401, { message: "Sua sessão expirou. Entre de novo." });
  c.set("user", user);
  await next();
};

export async function canAccessPatient(user: User, patientId: string) {
  if (user.role === "medico") {
    return Boolean(await prisma.doctorPatient.findUnique({ where: { doctorId_patientId: { doctorId: user.id, patientId } } }));
  }
  if (user.role === "cuidador") {
    return Boolean(await prisma.caregiver.findFirst({ where: { patientId, userId: user.id }, select: { id: true } }));
  }
  return Boolean(await prisma.patient.findFirst({ where: { id: patientId, userId: user.id }, select: { id: true } }));
}

// 404 (e não 403) para não revelar se a pessoa cuidada existe.
export async function assertPatientAccess(c: Context<AppEnv>, patientId: string) {
  if (!(await canAccessPatient(c.get("user"), patientId))) {
    throw new HTTPException(404, { message: "Paciente não encontrado." });
  }
}

export function assertDoctor(c: Context<AppEnv>) {
  if (c.get("user").role !== "medico") throw new HTTPException(403, { message: "Apenas médicos podem fazer isso." });
}

export async function readJson<T>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HTTPException(400, { message: "Dados inválidos." });
  }
}
