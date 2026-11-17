import { defineConfig } from "vite";

// En desarrollo (npm run dev) Vite hace el mismo trabajo que nginx en Docker:
// reenvía /api/... a los servicios, para que el navegador hable con un solo origen.
// Los servicios deben estar arriba (docker compose up -d analyzer ingest prolog).
const strip = (prefix: string) => (path: string) => path.replace(prefix, "");

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api/ingest": { target: "http://localhost:8080", rewrite: strip("/api/ingest") },
      "/api/analyzer": { target: "http://localhost:8081", rewrite: strip("/api/analyzer") },
      "/api/prolog": { target: "http://localhost:8082", rewrite: strip("/api/prolog") },
    },
  },
});
