import { API } from "../config";
import type { GameInstances, IngestStatus, PlayerSummary, ResultsOverview } from "./types";

const TIMEOUT_MS = 3000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lee las estadísticas directamente de GameStats, pasando por el proxy de la consola.
 * No calcula nada: solo pide y entrega lo que GameStats responde.
 */
export class StatsClient {
  /** Resumen por juego y general (Scala). */
  async overview(): Promise<ResultsOverview> {
    const body = await getJson(`${API.analyzer}/results/games`);
    if (!isRecord(body) || !Array.isArray(body.games) || !isRecord(body.total)) {
      throw new Error("/results/games no devolvió el formato esperado (¿GameStats v1.1?)");
    }
    return body as unknown as ResultsOverview;
  }

  /** Jugadores por juego (Scala). */
  async players(): Promise<PlayerSummary[]> {
    const body = await getJson(`${API.analyzer}/results/players`);
    return Array.isArray(body) ? (body as PlayerSummary[]) : [];
  }

  /** Estado del ingest (Go): partidas abiertas y, desde la v1.1, instancias por juego. */
  async ingestStatus(): Promise<IngestStatus> {
    const body = await getJson(`${API.ingest}/status`);
    const pipeline = isRecord(body) && isRecord(body.pipeline) ? body.pipeline : {};
    const open = pipeline.openMatches;
    return {
      openMatches: typeof open === "number" ? open : null,
      games: isRecord(pipeline.games) ? (pipeline.games as Record<string, GameInstances>) : null,
    };
  }
}
