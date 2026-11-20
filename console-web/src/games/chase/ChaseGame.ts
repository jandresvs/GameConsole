import { API } from "../../config.ts";
import { Game, type GameContext } from "../core/Game.ts";
import type { GameDefinition } from "../core/GameDefinition.ts";
import { Board } from "./Board.ts";
import { ChaseEvents } from "./ChaseEvents.ts";
import { ChaseMatch, type Outcome } from "./ChaseMatch.ts";
import { ChaseRenderer, type ChaseView } from "./ChaseRenderer.ts";
import type { Direction } from "./Direction.ts";
import { PrologRouteFinder } from "./PrologRouteFinder.ts";
import { CpuRacer, HumanRacer } from "./Racer.ts";

/** playerId de la CPU en los eventos. El usuario no puede llamarse así (ver PlayerProfile). */
export const CPU_ID = "cpu";

const CELL = 48; // píxeles por celda: sprites de 16×16 a 3×
const BAND = 40; // alto de la franja de arriba (datos) y del cuadro de diálogo de abajo

const KEYS: Readonly<Record<string, Direction>> = {
  ArrowUp: "arriba",
  KeyW: "arriba",
  ArrowDown: "abajo",
  KeyS: "abajo",
  ArrowLeft: "izquierda",
  KeyA: "izquierda",
  ArrowRight: "derecha",
  KeyD: "derecha",
};

export interface ChaseOptions {
  rows?: number;
  cols?: number;
  obstaclePct?: number;
  lives?: number;
}

/**
 * Chase en pantalla: La Buena (tú, el caballero dorado) y una segunda Buena
 * controlada por Prolog (el caballero azul) corren hacia La Mala (la bruja). Las reglas están en ChaseMatch; esta
 * clase conecta la partida con la consola:
 *
 *  - Extiende Game: la base emite MATCH_STARTED (con matchStartData),
 *    PLAYER_JOINED y MATCH_FINISHED. Lo propio de chase sale por ChaseEvents,
 *    que usa this.emit.
 *  - Cada flecha es una jugada (onKeyDown); el juego es por turnos, así que
 *    update() no hace nada y render() solo dibuja el estado actual.
 *  - Si la partida se cierra desde afuera, ChaseMatch se abandona y cancela
 *    lo que estuviera esperando a Prolog.
 */
export class ChaseGame extends Game {
  static readonly definition: GameDefinition = {
    id: "chase",
    title: "Chase",
    description: "La Buena vs La Mala: carrera por turnos contra una CPU que decide su ruta con Prolog (A*).",
    controls: "Flechas o WASD: un paso por turno; después mueve la CPU. Chocar con un obstáculo cuesta una vida.",
    create: (context) => new ChaseGame(context),
  };

  private readonly match: ChaseMatch;
  private readonly renderer: ChaseRenderer;
  private readonly startLives: number;
  private notice: string | null = null;

  constructor(context: GameContext, options: ChaseOptions = {}) {
    const rows = options.rows ?? 8;
    const cols = options.cols ?? 12;
    super("chase", context, { width: cols * CELL, height: rows * CELL + 2 * BAND });

    const { board, userStart, cpuStart } = Board.generate(rows, cols, options.obstaclePct ?? 20);
    this.startLives = options.lives ?? 3;
    const finder = new PrologRouteFinder({
      baseUrl: API.prolog,
      onUnavailable: (attempt) => (this.notice = `Prolog no responde (intento ${attempt}). Reintentando…`),
      onRecovered: () => (this.notice = null),
    });
    this.match = new ChaseMatch({
      board,
      user: new HumanRacer(this.playerId, userStart, this.startLives),
      cpu: new CpuRacer(CPU_ID, cpuStart, this.startLives),
      finder,
      events: new ChaseEvents(
        (type, data, playerId) => this.emit(type, data, playerId),
        (winnerId) => this.finish(winnerId),
      ),
    });
    this.renderer = new ChaseRenderer(rows, cols, CELL, BAND);
    this.onFinish(() => this.match.abandon()); // si ya había terminado, no hace nada
  }

  protected players(): readonly string[] {
    return [this.match.user.id, this.match.cpu.id];
  }

  protected override matchStartData() {
    const { board } = this.match;
    return { rows: board.rows, cols: board.cols, obstaclePct: board.obstaclePct, lives: this.startLives };
  }

  protected onStart(): void {
    void this.match.begin().catch((error: unknown) => (this.notice = `Error: ${String(error)}`));
  }

  protected update(): void {
    // Por turnos: no hay nada que avanzar entre cuadros.
  }

  protected render(ctx: CanvasRenderingContext2D): void {
    this.renderer.draw(ctx, this.match, this.view());
  }

  protected override onKeyDown(code: string): void {
    const direction = KEYS[code];
    if (!direction) return;
    void this.match.userMove(direction).catch((error: unknown) => (this.notice = `Error: ${String(error)}`));
  }

  private view(): ChaseView {
    const { match } = this;
    const base = { player: this.playerId, maxLives: this.startLives };
    const text = statusText(match, this.playerId);
    if (this.notice) return { ...base, status: `${text} — ${this.notice}`, tone: "notice" };
    const tone = match.outcome ? (isWin(match.outcome, this.playerId) ? "won" : "lost") : "normal";
    return { ...base, status: text, tone };
  }
}

function isWin(outcome: Outcome, playerId: string): boolean {
  return outcome.kind === "won" && outcome.winnerId === playerId;
}

function statusText(match: ChaseMatch, playerId: string): string {
  switch (match.phase) {
    case "preparing":
      return "Calculando rutas con Prolog…";
    case "playing":
      return "Tu turno: flechas o WASD";
    case "cpu-turn":
      return "Turno de la CPU…";
    case "finished":
      return outcomeText(match.outcome, playerId);
  }
}

function outcomeText(outcome: Outcome | null, playerId: string): string {
  switch (outcome?.kind) {
    case "won":
      return outcome.winnerId === playerId ? "¡Alcanzaste a La Mala! Ganaste." : "La CPU alcanzó primero a La Mala. Perdiste.";
    case "out-of-lives":
      return "Sin vidas. Nadie alcanzó a La Mala.";
    case "no-route":
      return "Este tablero no tiene ruta hasta La Mala. Abre otra partida.";
    case "abandoned":
    default:
      return "Partida cerrada.";
  }
}
