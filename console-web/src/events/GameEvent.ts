/** Datos propios de un evento. Los números van como número, no como texto. */
export type EventData = Record<string, unknown>;

/**
 * Un evento tal como lo recibe GameStats (docs/CONTRACT.md, sección 2).
 * Los juegos no arman esto a mano: lo hace MatchEvents.
 */
export interface GameEvent {
  readonly eventId: string;
  readonly timestamp: string; // ISO-8601 en UTC, terminado en Z
  readonly gameId: string;
  readonly gameVersion: string;
  readonly matchId: string;
  readonly playerId?: string;
  readonly type: string; // MAYUSCULAS_CON_GUION_BAJO
  readonly data?: EventData;
}

/**
 * A dónde van los eventos de los juegos. Es lo único que un juego sabe del envío.
 *
 * send() no debe bloquear ni lanzar errores: el juego sigue aunque la red falle.
 * La implementación real (cola, lotes y reintentos hacia GameStats) es la capa
 * de eventos; mientras tanto se usa LocalEventSink.
 */
export interface EventSink {
  send(event: GameEvent): void;
}
