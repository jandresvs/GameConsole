import type { EventData, EventSink, GameEvent } from "./GameEvent";

const TYPE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Arma los eventos de UNA partida y los entrega al EventSink.
 * Es el equivalente de `match` en el simulador de GameStats (add y finish),
 * pero con la hora real y enviando cada evento en el momento en que ocurre.
 *
 * Garantiza lo que exige el contrato:
 *  - eventId único: `<matchId>-<número>`.
 *  - timestamp en UTC y estrictamente creciente dentro de la partida, para que
 *    el orden que reconstruye Scala sea siempre el orden real.
 *  - MATCH_FINISHED es el último evento: después de finish() no sale nada más
 *    (GameStats lo descartaría como tardío).
 */
export class MatchEvents {
  private seq = 0;
  private lastTimeMs = 0;
  private closed = false;

  constructor(
    private readonly gameId: string,
    readonly matchId: string,
    private readonly gameVersion: string,
    private readonly sink: EventSink,
    private readonly now: () => number = Date.now,
  ) {}

  get isClosed(): boolean {
    return this.closed;
  }

  /** Emite un evento. Sin playerId = evento de la partida, no de un jugador. */
  add(type: string, data?: EventData, playerId?: string): void {
    if (this.closed) {
      console.warn(`[${this.matchId}] evento ${type} ignorado: la partida ya terminó`);
      return;
    }
    if (!TYPE_PATTERN.test(type)) {
      throw new Error(`Tipo de evento inválido "${type}": debe ir en MAYUSCULAS_CON_GUION_BAJO`);
    }
    if (playerId !== undefined && playerId.trim() === "") {
      throw new Error(`El evento ${type} trae un playerId vacío`);
    }

    this.seq += 1;
    this.lastTimeMs = Math.max(this.now(), this.lastTimeMs + 1);

    const event: GameEvent = {
      eventId: `${this.matchId}-${String(this.seq).padStart(4, "0")}`,
      timestamp: new Date(this.lastTimeMs).toISOString(),
      gameId: this.gameId,
      gameVersion: this.gameVersion,
      matchId: this.matchId,
      ...(playerId !== undefined && { playerId }),
      type,
      ...(data !== undefined && { data }),
    };
    this.sink.send(event);
  }

  /** Cierra la partida con MATCH_FINISHED. Sin winnerId = nadie ganó. */
  finish(winnerId?: string): void {
    if (this.closed) return;
    this.add("MATCH_FINISHED", winnerId !== undefined ? { winnerId } : undefined);
    this.closed = true;
  }
}
