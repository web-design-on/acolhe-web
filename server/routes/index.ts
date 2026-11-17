import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../auth.js";
import { prisma } from "../db.js";
import { alertRoutes } from "./alerts.js";
import { authRoutes } from "./auth.js";
import { availabilityRoutes } from "./availability.js";
import { careRoutes } from "./care.js";
import { patientRoutes } from "./patients.js";

export const app = new Hono<AppEnv>().basePath("/api");

// O portal é da mesma origem e o app nativo não passa por CORS: isto só vale para o app rodando no navegador (expo start --web).
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:8081").split(",").map((origin) => origin.trim()).filter(Boolean);
app.use("*", cors({ origin: allowedOrigins }));

app.get("/health", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ok: true, database: true });
  } catch {
    return c.json({ ok: false, database: false }, 503);
  }
});

app.route("/", authRoutes);
app.route("/", patientRoutes);
app.route("/", careRoutes);
app.route("/", alertRoutes);
app.route("/", availabilityRoutes);

app.notFound((c) => c.text("Rota não encontrada", 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.text(err.message, err.status);
  console.error(err);
  return c.text("Erro interno do servidor", 500);
});
