import { API, GAME_VERSION } from "../config";
import { newId } from "../events/ids";

export interface ConnectionTestResult {
  readonly ok: boolean;
  readonly lines: readonly string[];
}

/**
 * TEMPORAL: prueba de punta a punta del esqueleto (navegador → proxy → ingest).
 * Envía una partida mínima del juego ficticio "prueba" y lee /status.
 * Se elimina cuando exista la capa de eventos (tarea 3 de contextos/06-reparto.md).
 */
export class ConnectionTest {
  async run(): Promise<ConnectionTestResult> {
    const matchId = `prueba-${newId()}`;
    const events = ["MATCH_STARTED", "MATCH_FINISHED"].map((type) => ({
      eventId: newId(),
      timestamp: new Date().toISOString(), // UTC terminado en Z, como exige el contrato
      gameId: "prueba",
      gameVersion: GAME_VERSION,
      matchId,
      type,
    }));

    try {
      const post = await fetch(`${API.ingest}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(events),
      });
      const posted = (await post.json()) as { accepted?: number; rejected?: number; error?: string };
      if (!post.ok) {
        return { ok: false, lines: [`POST /events respondió ${post.status}: ${posted.error ?? "sin detalle"}`] };
      }

      const status = await fetch(`${API.ingest}/status`, { cache: "no-store" });
      const body = (await status.json()) as { pipeline?: { received?: number; openMatches?: number } };

      return {
        ok: posted.accepted === events.length,
        lines: [
          `Partida de prueba: ${matchId}`,
          `POST /events → ${post.status}: aceptados ${posted.accepted ?? 0}, rechazados ${posted.rejected ?? 0}`,
          `GET /status → recibidos en total ${body.pipeline?.received ?? "?"}, partidas abiertas ${body.pipeline?.openMatches ?? "?"}`,
        ],
      };
    } catch (err) {
      return { ok: false, lines: [`No se pudo hablar con el ingest: ${String(err)}`] };
    }
  }
}
