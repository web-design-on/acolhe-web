import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../auth.js";
import { getAvailability } from "../sus.js";

/** Estoque de remédios nas unidades do SUS. Público: são dados abertos e não usa o banco. */
export const availabilityRoutes = new Hono<AppEnv>();

/** Ex.: /api/medications/availability?city=355030&catmat=BR0268856U0042&catmat=BR0267691U0042 */
availabilityRoutes.get("/medications/availability", async (c) => {
  const city = c.req.query("city") ?? "";
  const catmatCodes = [...new Set(c.req.queries("catmat") ?? [])];
  if (!/^\d{6,7}$/.test(city)) throw new HTTPException(400, { message: "Informe o código IBGE do município." });
  if (!catmatCodes.length || catmatCodes.length > 10 || catmatCodes.some((code) => !/^[A-Z0-9]{6,20}$/.test(code))) {
    throw new HTTPException(400, { message: "Informe de 1 a 10 códigos CATMAT válidos." });
  }

  try {
    const result = await getAvailability(city.slice(0, 6), catmatCodes);
    // O estoque é atualizado uma vez por dia: a CDN do Vercel guarda a resposta por 6 h.
    c.header("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return c.json(result);
  } catch (err) {
    console.error(err);
    throw new HTTPException(502, { message: "Não foi possível consultar o estoque do SUS agora. Tente de novo em alguns minutos." });
  }
});
