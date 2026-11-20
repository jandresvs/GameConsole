import { API } from "../../config.ts";
import { Game, type GameContext } from "../core/Game.ts";
import type { GameDefinition, GameSettings } from "../core/GameDefinition.ts";
import { Random } from "../core/Random.ts";
import { ChaseEvents } from "./ChaseEvents.ts";
import { ChaseMatch, type Outcome } from "./ChaseMatch.ts";
import { ChaseRenderer, type ChaseView } from "./ChaseRenderer.ts";
import { CHASE_OPTIONS, chaseFollowUps, type ChaseConfig, parseChaseSettings, secondPlayerId } from "./ChaseSettings.ts";
import type { Direction } from "./Direction.ts";
import { levelInfo } from "./Levels.ts";
import { type BuiltMap, MapBuilder } from "./MapBuilder.ts";
import { DIFFICULTIES } from "./Pace.ts";
import { PrologRouteFinder } from "./PrologRouteFinder.ts";
import { CpuRacer, HumanRacer } from "./Racer.ts";

/** playerId de la IA en los eventos. El usuario no puede llamarse así (ver PlayerProfile). */
export const CPU_ID = "cpu";

const CELL = 48; // píxeles por celda: sprites de 16×16 a 3×
const BAND = 44; // alto de la franja de arriba (datos) y del cuadro de diálogo de abajo

/** Tamaño y exigencia del mapa. */
const MAP = { rows: 10, cols: 14, obstaclePct: 22, minSteps: 12 } as const;
const LIVES = 3;

type KeyMap = ReadonlyMap<string, Direction>;

const WASD: KeyMap = new Map<string, Direction>([
  ["KeyW", "arriba"],
  ["KeyS", "abajo"],
  ["KeyA", "izquierda"],
  ["KeyD", "derecha"],
]);
const ARROWS: KeyMap = new Map<string, Direction>([
  ["ArrowUp", "arriba"],
  ["ArrowDown", "abajo"],
  ["ArrowLeft", "izquierda"],
  ["ArrowRight", "derecha"],
]);

/**
 * Chase en pantalla: una carrera en tiempo real hacia la salida del mapa (siempre en un borde). Se juega
 * contra una IA que decide con Prolog (cada nivel la hace más rápida) o humano contra humano en el mismo
 * teclado. Las reglas están en ChaseMatch; esta clase conecta la partida con la consola:
 *
 *  - Extiende Game: la base emite MATCH_STARTED (con matchStartData), PLAYER_JOINED y MATCH_FINISHED.
 *    Lo propio de chase sale por ChaseEvents, que usa this.emit.
 *  - Antes de empezar genera el mapa y le pide a Prolog que confirme que tiene ruta; solo entonces llama a
 *    la base (por eso sobrescribe start()). Mientras tanto el lienzo muestra "Preparando…".
 *  - Es en tiempo real: update(dtMs) avanza el reloj de la partida y lee las teclas mantenidas; onKeyDown
 *    atiende las pulsaciones. Una persona no puede moverse más de una vez cada 0,5 s.
 *  - Si la partida se cierra desde afuera, ChaseMatch se abandona y cancela lo que esperara a Prolog.
 */
export class ChaseGame extends Game {
  static readonly definition: GameDefinition = {
    id: "chase",
    title: "Chase",
    description:
      "Carrera en tiempo real hacia la salida del mapa: contra una IA que decide con Prolog (4 niveles de dificultad) o humano contra humano.",
    controls:
      "WASD o flechas. Humano contra humano: jugador 1 con WASD y jugador 2 con las flechas. Un movimiento cada 0,5 s; chocar con un obstáculo cuesta una vida.",
    options: CHASE_OPTIONS,
    create: (context, settings) => new ChaseGame(context, settings),
    afterMatch: ({ result, settings, playerId }) => chaseFollowUps(result, settings, playerId),
  };

  private readonly config: ChaseConfig;
  private readonly finder: PrologRouteFinder;
  private readonly renderer = new ChaseRenderer(MAP.rows, MAP.cols, CELL, BAND);
  private readonly random = new Random();
  private readonly preparation = new AbortController();
  private match: ChaseMatch | null = null;
  private preparing = false;
  private disposed = false;
  private notice: string | null = null;

  constructor(context: GameContext, settings: GameSettings = {}) {
    super("chase", context, { width: MAP.cols * CELL, height: MAP.rows * CELL + 2 * BAND });
    this.config = parseChaseSettings(settings);
    this.finder = new PrologRouteFinder({
      baseUrl: API.prolog,
      onUnavailable: (attempt) => this.setNotice(`Prolog no responde (intento ${attempt}). Reintentando…`),
      onRecovered: () => this.setNotice(null),
    });
    this.onFinish(() => this.match?.abandon()); // si la partida ya había terminado, no hace nada
    this.drawPlaceholder();
  }

  /** Genera el mapa (Prolog confirma que hay ruta) y, cuando está listo, empieza la partida. */
  override start(): void {
    if (this.state !== "ready" || this.preparing) return;
    this.preparing = true;
    void this.prepare();
  }

  override dispose(): void {
    this.disposed = true;
    this.preparation.abort();
    super.dispose();
  }

  protected players(): readonly string[] {
    return this.match?.racers.map((r) => r.id) ?? [];
  }

  protected override matchStartData() {
    const match = this.requireMatch();
    const { board } = match;
    return {
      rows: board.rows,
      cols: board.cols,
      obstaclePct: board.obstaclePct,
      lives: LIVES,
      mode: match.mode,
      exit: board.exit.toJSON(),
      humanCooldownMs: match.humans[0]?.cooldownMs,
      ...(match.cpu && match.difficulty
        ? { difficulty: match.difficulty, cpuIntervalMs: match.cpu.intervalMs, level: levelInfo(match.difficulty).number }
        : {}),
    };
  }

  protected onStart(): void {
    this.requireMatch().begin();
  }

  protected update(dtMs: number): void {
    const match = this.match;
    if (!match) return;
    match.tick(dtMs);

    // Tecla mantenida: avanza una celda cada vez que termina la espera (pero nunca choca sola).
    match.humans.forEach((human, index) => {
      for (const [code, direction] of this.keysFor(index)) {
        if (this.keyboard.isDown(code)) {
          match.holdHuman(human.id, direction);
          return;
        }
      }
    });
  }

  protected render(ctx: CanvasRenderingContext2D): void {
    if (!this.match) {
      this.drawPlaceholder();
      return;
    }
    this.renderer.draw(ctx, this.match, this.view(this.match));
  }

  protected override onKeyDown(code: string): void {
    const match = this.match;
    if (!match) return;
    match.humans.forEach((human, index) => {
      const direction = this.keysFor(index).get(code);
      if (direction) match.moveHuman(human.id, direction);
    });
  }

  // ───────────── Preparación ─────────────

  private async prepare(): Promise<void> {
    try {
      const built = await new MapBuilder(this.finder, () => this.random.next()).build(MAP, this.preparation.signal);
      if (this.disposed || this.state !== "ready") return; // se cerró mientras se esperaba a Prolog
      this.match = this.createMatch(built);
      super.start();
    } catch (error) {
      if (this.disposed) return;
      this.notice = `No se pudo preparar la partida: ${String(error)}`;
      this.drawPlaceholder();
    }
  }

  private createMatch({ board, route }: BuiltMap): ChaseMatch {
    const humans = [new HumanRacer(this.playerId, board.start, LIVES)];
    if (this.config.mode === "vs-human") humans.push(new HumanRacer(secondPlayerId(this.playerId), board.start, LIVES));
    const cpu =
      this.config.mode === "vs-cpu"
        ? new CpuRacer(CPU_ID, board.start, LIVES, DIFFICULTIES[this.config.difficulty].cpuIntervalMs)
        : undefined;

    return new ChaseMatch({
      board,
      route,
      humans,
      cpu,
      difficulty: cpu ? this.config.difficulty : undefined,
      finder: this.finder,
      events: new ChaseEvents(
        (type, data, playerId) => this.emit(type, data, playerId),
        (winnerId) => this.finish(winnerId),
      ),
    });
  }

  private requireMatch(): ChaseMatch {
    if (!this.match) throw new Error("La partida de chase todavía no tiene mapa");
    return this.match;
  }

  /** Mientras no hay mapa: un cartel en el lienzo (y el aviso si Prolog no responde). */
  private drawPlaceholder(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#14161d";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#e8eaf0";
    ctx.font = "bold 18px 'Courier New', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Preparando el mapa con Prolog…", this.canvas.width / 2, this.canvas.height / 2 - 12);
    if (this.notice) {
      ctx.fillStyle = "#f2c75a";
      ctx.font = "14px 'Courier New', ui-monospace, monospace";
      ctx.fillText(this.notice, this.canvas.width / 2, this.canvas.height / 2 + 16);
    }
  }

  private setNotice(text: string | null): void {
    this.notice = text;
    if (!this.match) this.drawPlaceholder();
  }

  // ───────────── Teclado ─────────────

  /** Las teclas de cada persona. Contra la IA una sola persona usa WASD y flechas; entre humanos, cada una las suyas. */
  private keysFor(index: number): KeyMap {
    if (this.config.mode === "vs-human") return index === 0 ? WASD : ARROWS;
    return new Map([...WASD, ...ARROWS]);
  }

  // ───────────── Lo que se ve ─────────────

  private view(match: ChaseMatch): ChaseView {
    const difficulty = match.difficulty;
    const base = {
      maxLives: LIVES,
      heading: difficulty
        ? `Nivel ${levelInfo(difficulty).number} de ${levelInfo(difficulty).total}`
        : "Humano vs humano",
      cpuLabel: difficulty ? `IA ${levelInfo(difficulty).label}` : "IA",
    };
    const text = statusText(match, this.playerId);
    if (this.notice) return { ...base, status: `${text} — ${this.notice}`, tone: "notice" };
    const tone = match.outcome ? (isHumanWin(match, match.outcome) ? "won" : "lost") : "normal";
    return { ...base, status: text, tone };
  }
}

function isHumanWin(match: ChaseMatch, outcome: Outcome): boolean {
  return outcome.kind === "won" && match.humans.some((h) => h.id === outcome.winnerId);
}

function statusText(match: ChaseMatch, playerId: string): string {
  switch (match.phase) {
    case "ready":
      return "Preparando la partida…";
    case "countdown":
      return `Prepárense… ${Math.max(1, Math.ceil(match.countdownLeftMs / 1000))}`;
    case "playing":
      return match.mode === "vs-cpu"
        ? "¡Ya! Llega a la salida antes que la IA."
        : "¡Ya! Gana quien llegue primero a la salida.";
    case "finished":
      return outcomeText(match, playerId);
  }
}

function outcomeText(match: ChaseMatch, playerId: string): string {
  const outcome = match.outcome;
  switch (outcome?.kind) {
    case "won": {
      if (outcome.winnerId === CPU_ID) return "La IA llegó primero a la salida. Perdiste.";
      if (match.mode === "vs-cpu") {
        const level = match.difficulty ? levelInfo(match.difficulty) : null;
        return level?.isLast ? "¡Llegaste primero! Completaste todos los niveles." : "¡Llegaste primero a la salida! Nivel superado.";
      }
      return `¡${outcome.winnerId === playerId ? playerId : outcome.winnerId} llegó primero a la salida!`;
    }
    case "all-eliminated":
      return "Todos se quedaron sin vidas. Nadie llegó a la salida.";
    case "abandoned":
    default:
      return match.error ? `Partida cerrada por un error: ${match.error.message}` : "Partida cerrada.";
  }
}
