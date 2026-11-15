import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // A API local (npm run dev:api) roda em outra porta; assim o site chama /api como no Vercel.
    proxy: { "/api": `http://localhost:${process.env.API_PORT ?? 3334}` },
  },
});
