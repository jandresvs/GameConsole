import type { EventSender } from "../../events/types.ts";
import { newId } from "../../events/ids.ts";
import type { Board } from "./Board.ts";
import type { Direction } from "./Direction.ts";
import { ChaseEvents } from "./ChaseEvents.ts";
import type { CpuRacer, HumanRacer } from "./Racer.ts";
import type { RouteFinder } from "./RouteFinder.ts";

export type Phase = "preparing" | "playing" | "cpu-turn" | "finished";

export type Outcome =
  | { kind: "won"; winnerId: string }
  | { kind: "out-of-lives" }
  | { kind: "no-route" }
  | { kind: "abandoned" };

/** Qué pasó con la jugada del usuario. */
export type MoveResult = "ignored" | "edge" | "moved" | "hit" | "reached" | "out-of-lives";

export interface ChaseMatchOptions {
  board: Board;
  user: HumanRacer;
  cpu: CpuRacer;
  finder: RouteFinder;
  sender: EventSender;
  matchId?: string;
  /** Pausa antes de que la CPU mueva, para que se vea. En pruebas: 0. */
  cpuDelayMs?: number;
  pause?: (ms: number) => Promise<void>;
}

/**
 * Las reglas de una partida de chase, sin nada de pantalla.
 *
 * Es una carrera por turnos: el usuario y la CPU compiten por llegar primero a
 * La Mala. Cada turno del usuario (moverse o chocar) va seguido de uno de la CPU.
 * Chocar con un obstáculo cuesta una vida y el turno; sin vidas, se acaba.
 * Gana quien alcanza primero a La Mala; si nadie lo logra no hay ganador.
 */
export class ChaseMatch {
  readonly gameId = "chase";
  readonly matchId: string;
  readonly board: Board;
  readonly user: HumanRacer;
  readonly cpu: CpuRacer;

  private readonly finder: RouteFinder;
  private readonly events: ChaseEvents;
  private readonly cpuDelayMs: number;
  private readonly pause: (ms: number) => Promise<void>;
  private readonly abortController = new AbortController();
  private readonly listeners = new Set<() => void>();
  private currentPhase: Phase = "preparing";
  private currentOutcome: Outcome | null = null;

  constructor(opts: ChaseMatchOptions) {
    this.matchId = opts.matchId ?? `chase-${newId()}`;
    this.board = opts.board;
    this.user = opts.user;
    this.cpu = opts.cpu;
    this.finder = opts.finder;
    this.events = new ChaseEvents(opts.sender, this.matchId);
    this.cpuDelayMs = opts.cpuDelayMs ?? 450;
    this.pause = opts.pause ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  get phase(): Phase {
    return this.currentPhase;
  }

  get outcome(): Outcome | null {
    return this.currentOutcome;
  }

  /** Avisa cada vez que cambia algo visible. Devuelve la función para dejar de escuchar. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Abre la partida: eventos de inicio y ruta óptima de cada jugador (Prolog).
   * Si Prolog no responde espera y reintenta; si el tablero no tiene ruta, la
   * partida termina sin ganador.
   */
  async begin(): Promise<void> {
    if (this.currentPhase !== "preparing") return;
    this.events.matchStarted(this.board, this.user.lives);
    this.events.playerJoined(this.user.id);
    this.events.playerJoined(this.cpu.id);

    const signal = this.abortController.signal;
    try {
      const [userRoute, cpuRoute] = await Promise.all([
        this.finder.findRoute(this.board, this.user.position, signal),
        this.finder.findRoute(this.board, this.cpu.position, signal),
      ]);
      if (this.isFinished()) return;
      this.events.routeComputed(this.user.id, this.user.position, this.board.target, userRoute);
      this.events.routeComputed(this.cpu.id, this.cpu.position, this.board.target, cpuRoute);
      if (!userRoute.found || !cpuRoute.found) {
        this.finish({ kind: "no-route" });
        return;
      }
      this.currentPhase = "playing";
      this.notify();
    } catch (error) {
      // Si la partida ya estaba cerrada, el error es solo la cancelación de la espera a Prolog.
      const cancelled = this.isFinished();
      if (!cancelled) this.finish({ kind: "abandoned" });
      if (!cancelled) throw error;
    }
  }

  /** Jugada del usuario; si la partida sigue, a continuación mueve la CPU. */
  async userMove(direction: Direction): Promise<MoveResult> {
    if (this.currentPhase !== "playing") return "ignored";

    const result = this.applyUserMove(direction);
    if (result === "edge" || this.isFinished()) {
      this.notify();
      return result;
    }

    // Se cambia de fase antes del primer await: mientras la CPU piensa no entran más jugadas.
    this.currentPhase = "cpu-turn";
    this.notify();
    try {
      await this.cpuTurn();
    } catch (error) {
      const cancelled = this.isFinished(); // se cerró mientras esperaba a Prolog
      if (!cancelled) this.finish({ kind: "abandoned" });
      if (!cancelled) throw error;
      return result;
    }
    if (this.currentPhase === "cpu-turn") {
      this.currentPhase = "playing";
      this.notify();
    }
    return result;
  }

  /** El usuario se rinde o cierra la partida: se cierra con MATCH_FINISHED sin ganador. */
  abandon(): void {
    this.finish({ kind: "abandoned" });
  }

  private applyUserMove(direction: Direction): MoveResult {
    const next = this.user.position.step(direction);
    if (!this.board.inBounds(next)) return "edge"; // contra el borde: no cuenta como jugada

    if (this.board.isObstacle(next)) {
      const left = this.user.loseLife();
      this.events.obstacleHit(this.user.id, next, left);
      if (left === 0) {
        this.finish({ kind: "out-of-lives" });
        return "out-of-lives";
      }
      return "hit";
    }

    const { position, turn } = this.user.advance(direction);
    this.events.moved(this.user.id, position, direction, turn);
    if (position.equals(this.board.target)) {
      this.events.targetReached(this.user.id, this.user.steps, this.user.turns);
      this.finish({ kind: "won", winnerId: this.user.id });
      return "reached";
    }
    return "moved";
  }

  private async cpuTurn(): Promise<void> {
    await this.pause(this.cpuDelayMs);
    if (this.isFinished()) return;

    // La decisión sale de Prolog: se le manda el tablero y se ejecuta su primer paso.
    const direction = await this.cpu.chooseMove(this.board, this.finder, this.abortController.signal);
    if (this.isFinished() || direction === null) return;

    const next = this.cpu.position.step(direction);
    if (!this.board.inBounds(next) || this.board.isObstacle(next)) {
      throw new Error(`Prolog devolvió una jugada inválida para la CPU: ${direction}`);
    }
    const { position, turn } = this.cpu.advance(direction);
    this.events.moved(this.cpu.id, position, direction, turn);
    if (position.equals(this.board.target)) {
      this.events.targetReached(this.cpu.id, this.cpu.steps, this.cpu.turns);
      this.finish({ kind: "won", winnerId: this.cpu.id });
    }
  }

  private finish(outcome: Outcome): void {
    if (this.isFinished()) return;
    this.currentPhase = "finished";
    this.currentOutcome = outcome;
    this.events.matchFinished(outcome.kind === "won" ? outcome.winnerId : undefined);
    this.abortController.abort(); // cancela lo que siga esperando a Prolog
    this.notify();
  }

  /** Método y no comparación directa: tras cada await la fase pudo cambiar y TypeScript no lo sabe. */
  private isFinished(): boolean {
    return this.currentPhase === "finished";
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
