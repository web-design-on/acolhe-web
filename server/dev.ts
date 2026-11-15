import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./routes/index.js";

const port = Number(process.env.API_PORT ?? 3334);

serve({ fetch: app.fetch, port }, () => {
  console.log(`API do Acolhe em http://localhost:${port}/api`);
});
