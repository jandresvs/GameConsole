/**
 * PROVISIONAL: clase base de los juegos, escrita para poder construir `chase`.
 * El contrato definitivo es la tarea A2 (contextos/06-reparto.md); si cambia,
 * se ajusta aquí y en los juegos.
 */
/** Controles que un juego muestra antes de empezar (modo, dificultad...). */
export interface GameSettingsForm {
  readonly element: HTMLElement;
}

export abstract class Game {
  /** gameId del contrato de GameStats: combat, racing o chase. */
  readonly gameId: string;

  protected constructor(gameId: string) {
    this.gameId = gameId;
  }

  /**
   * Quien muestre el matchId lo registra aquí. Un juego con niveles abre una partida
   * nueva (otro matchId) en la misma instancia y avisa por este medio.
   */
  onMatchIdChange: ((matchId: string) => void) | null = null;

  /** Identifica la partida en curso; es el matchId de todos sus eventos. */
  abstract get matchId(): string;

  /** Dibuja el juego dentro del contenedor y empieza la partida. */
  abstract mount(container: HTMLElement): void;

  /** Termina la partida (si seguía abierta, la cierra con MATCH_FINISHED) y libera todo. */
  abstract dispose(): void;
}
