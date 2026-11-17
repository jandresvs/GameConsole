// Rutas hacia los servicios. El navegador nunca llama a GameStats ni a Prolog
// directamente: todo pasa por el mismo origen (/api/...), que nginx reenvía
// en Docker y Vite reenvía en desarrollo. Ver contextos/03-arquitectura.md.
export const API = {
  ingest: "/api/ingest", // GameStats, módulo Go: POST /events, GET /status, /rejected
  analyzer: "/api/analyzer", // GameStats, módulo Scala: GET /results/... (solo lectura)
  prolog: "/api/prolog", // servicio de inteligencia en SWI-Prolog
} as const;

export const GAME_VERSION = "1.0";
