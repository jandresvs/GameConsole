// Forma de las respuestas de GameStats que usa el panel.
// Referencia: docs/CONTRACT.md del repo de GameStats (secciones 4.2, 4.3 y 6.5).

/** Un resumen por juego de GET /results/games (analizador, sección 4.3). */
export interface GameSummary {
  gameId: string;
  matchesAnalyzed: number;
  matchesWithWinner: number;
  playersCount: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  eventCounts: Record<string, number>;
  patternCounts: Record<string, number>;
  counters: Record<string, number>;
  derived: Record<string, number>;
}

export interface OverallSummary {
  gamesCount: number;
  matchesAnalyzed: number;
  matchesWithWinner: number;
  playersCount: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  eventCounts: Record<string, number>;
  patternCounts: Record<string, number>;
}

export interface ResultsOverview {
  games: GameSummary[];
  total: OverallSummary;
}

/** GET /results/players (analizador, sección 4.2). */
export interface PlayerSummary {
  gameId: string;
  playerId: string;
  matchesPlayed: number;
  wins: number;
}

/**
 * Instancias de un juego según el ingest (Go), GET /status → pipeline.games[gameId].
 * `opened`: partidas abiertas desde que arrancó el ingest (incluye las que siguen en curso).
 * `delivered`: partidas ya entregadas al analizador.
 * Es la parte de GameStats v1.1 (tarea A6); si el ingest aún no la trae, el panel lo indica.
 */
export interface GameInstances {
  opened: number;
  delivered: number;
}

export interface IngestStatus {
  openMatches: number | null;
  games: Record<string, GameInstances> | null;
}
