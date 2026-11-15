import { handle } from "hono/vercel";
import { app } from "../server/routes/index.js";

/** Função do Vercel: todas as rotas /api/* chegam aqui (veja vercel.json). */
const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
