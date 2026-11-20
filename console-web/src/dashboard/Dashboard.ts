import { el } from "../console/dom";
import { StatsClient } from "./StatsClient";
import type { GameSummary, IngestStatus, OverallSummary, PlayerSummary, ResultsOverview } from "./types";

/** Cómo mostrar cada métrica derivada que calculan los analizadores de GameStats. */
type Kind = "percent" | "number" | "ms";
const METRICS: Readonly<Record<string, { label: string; kind: Kind }>> = {
  // combat
  kd: { label: "K/D", kind: "number" },
  accuracy: { label: "Precisión", kind: "percent" },
  avgDamagePerHit: { label: "Daño por impacto", kind: "number" },
  // racing
  avgLapMs: { label: "Vuelta promedio", kind: "ms" },
  consistencyMs: { label: "Consistencia (desv.)", kind: "ms" },
  crashRate: { label: "Choques por vuelta", kind: "number" },
  timeLostPct: { label: "Tiempo perdido en choques", kind: "percent" },
  // chase
  successRate: { label: "Llegadas a La Mala", kind: "percent" },
  efficiency: { label: "Eficiencia de ruta", kind: "percent" },
  extraTurnsPerWin: { label: "Giros extra por llegada", kind: "number" },
  hitsPerMatch: { label: "Choques por partida", kind: "number" },
};

const GAME_TITLES: Readonly<Record<string, string>> = { combat: "Combat", racing: "Racing", chase: "Chase" };

const number = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 });

function formatMetric(value: number, kind: Kind): string {
  if (kind === "percent") return percent.format(value);
  if (kind === "ms") return `${number.format(value / 1000)} s`;
  return number.format(value);
}

function formatSeconds(seconds: number): string {
  return `${number.format(seconds)} s`;
}

/** Una fila "etiqueta ........ valor". */
function row(label: string, value: string): HTMLElement {
  return el("div", "stat-row", el("span", "muted", label), el("strong", "", value));
}

/**
 * Panel de estadísticas. Pide los números a GameStats cada `intervalMs` y los
 * dibuja; no suma ni calcula nada por su cuenta. Separa con claridad lo de cada
 * juego (tarjetas) de lo general (bloque "General").
 */
export class Dashboard {
  private readonly client = new StatsClient();
  private readonly body = el("div", "dashboard");
  private readonly stamp = el("span", "muted", "esperando datos…");
  private timer: number | undefined;
  private loading = false;

  constructor(
    /** Juegos que siempre se muestran, aunque todavía no tengan partidas. */
    private readonly gameIds: readonly string[],
    private readonly intervalMs = 2000,
  ) {}

  element(): HTMLElement {
    return el("div", "", el("p", "dash-stamp", "Última actualización: ", this.stamp), this.body);
  }

  start(): void {
    if (this.timer !== undefined) return;
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), this.intervalMs);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private async refresh(): Promise<void> {
    if (this.loading) return; // si una consulta tarda, no se encimen
    this.loading = true;
    try {
      // El estado del ingest es opcional: si falla, el resto del panel igual se muestra.
      const [overview, players, status] = await Promise.all([
        this.client.overview(),
        this.client.players().catch((): PlayerSummary[] => []),
        this.client.ingestStatus().catch((): IngestStatus => ({ openMatches: null, games: null })),
      ]);
      this.render(overview, players, status);
      this.stamp.textContent = new Date().toLocaleTimeString("es");
    } catch (error) {
      this.renderError(error);
    } finally {
      this.loading = false;
    }
  }

  private renderError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.body.replaceChildren(
      el("p", "dash-error", `No se pudieron obtener las estadísticas de GameStats: ${message}`),
      el("p", "muted", "Se vuelve a intentar automáticamente."),
    );
  }

  private render(overview: ResultsOverview, players: PlayerSummary[], status: IngestStatus): void {
    const byGame = new Map(overview.games.map((g) => [g.gameId, g]));
    // Los tres juegos primero, en orden fijo; luego cualquier otro que GameStats conozca.
    const ids = [...this.gameIds, ...overview.games.map((g) => g.gameId).filter((id) => !this.gameIds.includes(id))];

    const grid = el("div", "games");
    for (const id of ids) grid.append(this.gameCard(id, byGame.get(id), players, status));

    this.body.replaceChildren(
      el("h3", "dash-title", "Por juego"),
      grid,
      el("h3", "dash-title", "General"),
      this.overallCard(overview.total, status),
    );
  }

  private gameCard(id: string, game: GameSummary | undefined, players: PlayerSummary[], status: IngestStatus): HTMLElement {
    const card = el("article", "card", el("div", "card-head", el("h3", "", GAME_TITLES[id] ?? id), el("code", "", id)));

    // Instancias: lo que dice el ingest (Go), no lo que la consola contó.
    // Si el ingest ya reporta por juego, un juego sin entrada tiene 0 instancias.
    const opened = status.games ? (status.games[id]?.opened ?? 0) : null;
    card.append(
      row("Instancias ejecutadas", opened === null ? "—" : integer.format(opened)),
      row("Partidas terminadas y analizadas", integer.format(game?.matchesAnalyzed ?? 0)),
    );
    if (!status.games) {
      card.append(el("p", "muted small", "El conteo de instancias requiere GameStats v1.1 (/status por juego)."));
    }
    if (!game) {
      card.append(el("p", "muted", "Sin partidas analizadas todavía."));
      return card;
    }

    card.append(
      row("Jugadores distintos", integer.format(game.playersCount)),
      row("Con ganador", integer.format(game.matchesWithWinner)),
      row("Duración promedio", formatSeconds(game.avgDurationSeconds)),
    );
    for (const [key, value] of Object.entries(game.derived)) {
      const metric = METRICS[key];
      card.append(row(metric?.label ?? key, formatMetric(value, metric?.kind ?? "number")));
    }
    this.appendCounts(card, "Patrones detectados", game.patternCounts);
    this.appendPlayers(card, players.filter((p) => p.gameId === id));
    return card;
  }

  private overallCard(total: OverallSummary, status: IngestStatus): HTMLElement {
    const card = el("article", "card");
    const opened = status.games ? Object.values(status.games).reduce((sum, g) => sum + g.opened, 0) : null;
    card.append(
      row("Instancias ejecutadas (todos los juegos)", opened === null ? "—" : integer.format(opened)),
      row("Partidas en curso ahora", status.openMatches === null ? "—" : integer.format(status.openMatches)),
      row("Partidas terminadas y analizadas", integer.format(total.matchesAnalyzed)),
      row("Jugadores distintos", integer.format(total.playersCount)),
      row("Duración promedio", formatSeconds(total.avgDurationSeconds)),
      row("Duración acumulada", formatSeconds(total.totalDurationSeconds)),
    );
    this.appendCounts(card, "Patrones detectados", total.patternCounts);
    return card;
  }

  private appendCounts(card: HTMLElement, title: string, counts: Record<string, number>): void {
    const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return;
    card.append(el("p", "dash-sub", title));
    for (const [name, count] of entries) card.append(row(name, integer.format(count)));
  }

  private appendPlayers(card: HTMLElement, players: PlayerSummary[]): void {
    if (players.length === 0) return;
    card.append(el("p", "dash-sub", "Jugadores (victorias / partidas)"));
    for (const p of players) card.append(row(p.playerId, `${p.wins} / ${p.matchesPlayed}`));
  }
}
