import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --tsconfig tsconfig.server.json prisma/seed.ts",
  },
  // process.env (e não env()): o build roda mesmo sem banco configurado.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
