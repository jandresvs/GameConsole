// Evento en el formato de GameStats (docs/CONTRACT.md, sección 2) y la interfaz
// con la que los juegos lo entregan. Los juegos solo conocen EventSender: cómo
// se encola, se agrupa y se reintenta el envío es asunto de quien lo implemente.

export interface GameEvent {
  eventId: string;
  /** UTC terminado en Z (new Date().toISOString()). */
  timestamp: string;
  gameId: string;
  gameVersion: string;
  matchId: string;
  /** No va en MATCH_STARTED ni MATCH_FINISHED. */
  playerId?: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface EventSender {
  /** Encola el evento y vuelve de inmediato: nunca debe bloquear el juego. */
  send(event: GameEvent): void;
}
