import type { EventSender } from "../../events/types.ts";
import { newId } from "../../events/ids.ts";
import type { Board } from "./Board.ts";
import { ChaseEvents } from "./ChaseEvents.ts";
import { type Clock, SystemClock } from "./Clock.ts";
import type { Direction } from "./Direction.ts";
import { DIFFICULTIES, type Difficulty, HUMAN_COOLDOWN_MS } from "./Pace.ts";
import type { CpuRacer, HumanRacer, Racer } from "./Racer.ts";
import type { Route, RouteFinder } from "./RouteFinder.ts";

export type Mode = "vs-cpu" | "vs-human";
export type Phase = "preparing" | "countdown" | "playing" | "finished";

export type Outcome =
  | { kind: "won"; winnerId: string }
  | { kind: "all-eliminated" }
  | { kind: "abandoned" };

/** Qué pasó con la jugada de una persona. */
export type MoveResult = "ignored" | "cooldown" | "edge" | "moved" | "hit" | "eliminated" | "reached";

export interface ChaseMatchOptions {
  board: Board;
  /** Ruta óptima desde el inicio (la calculó Prolog al generar el mapa). */
  route: Route;
  /** Una o dos personas, ya colocadas en `board.start`. */
  humans: HumanRacer[];
  /** Si hay IA, la partida es "vs-cpu"; si no, "vs-human". */
  cpu?: CpuRacer;
  difficulty?: Difficulty;
  finder: RouteFinder;
  sender: EventSender;
  clock?: Clock;
  matchId?: string;
  /** Cuenta regresiva antes de que todos puedan moverse. */
  countdownMs?: number;
}

/**
 * Las reglas de una partida de chase en tiempo real, sin nada de pantalla.
 *
 * Todos corren a la vez por el mismo mapa hacia la salida (en un borde). Una
 * persona no puede moverse más de una vez cada 0,5 s; la IA mueve sola cada cierto
 * tiempo (según la dificultad) y en cada paso le pregunta a Prolog por dónde ir.
 * Chocar con un obstáculo cuesta una vida y el tiempo de espera; sin vidas, esa
 * persona queda eliminada. Gana quien llega primero a la salida.
 */
export class ChaseMatch {
  readonly gameId = "chase";
  readonly matchId: string;
  readonly board: Board;
  readonly humans: readonly HumanRacer[];
  readonly cpu: CpuRacer | undefined;
  readonly difficulty: Difficulty | undefined;

  private readonly route: Route;
  private readonly finder: RouteFinder;
  private readonly events: ChaseEvents;
  private readonly clock: Clock;
  private readonly countdownMs: number;
  private readonly abortController = new AbortController();
  private readonly listeners = new Set<() => void>();
  private currentPhase: Phase = "preparing";
  private currentOutcome: Outcome | null = null;
  private failure: Error | null = null;
  private goAt = 0;
  private startedAt = 0;
  private finishedAt = 0;

  constructor(opts: ChaseMatchOptions) {
    this.matchId = opts.matchId ?? `chase-${newId()}`;
    this.board = opts.board;
    this.route = opts.route;
    this.humans = opts.humans;
    this.cpu = opts.cpu;
    this.difficulty = opts.difficulty;
    this.finder = opts.finder;
    this.events = new ChaseEvents(opts.sender, this.matchId);
    this.clock = opts.clock ?? new SystemClock();
    this.countdownMs = opts.countdownMs ?? 3000;

    const ids = this.racers.map((r) => r.id);
    if (new Set(ids).size !== ids.length) throw new Error("Los jugadores necesitan nombres distintos");
  }

  get mode(): Mode {
    return this.cpu ? "vs-cpu" : "vs-human";
  }

  /** Todos los participantes, personas primero. */
  get racers(): readonly Racer[] {
    return this.cpu ? [...this.humans, this.cpu] : this.humans;
  }

  get phase(): Phase {
    return this.currentPhase;
  }

  get outcome(): Outcome | null {
    return this.currentOutcome;
  }

  /** Error inesperado que cerró la partida (por ejemplo, una jugada inválida de Prolog). */
  get error(): Error | null {
    return this.failure;
  }

  /** Milisegundos que faltan para empezar (solo en la cuenta regresiva). */
  countdownLeftMs(): number {
    return this.currentPhase === "countdown" ? Math.max(0, this.goAt - this.clock.now()) : 0;
  }

  /** Tiempo de juego transcurrido; se congela al terminar. */
  elapsedMs(): number {
    if (this.currentPhase === "playing") return this.clock.now() - this.startedAt;
    if (this.currentPhase === "finished" && this.startedAt > 0) return this.finishedAt - this.startedAt;
    return 0;
  }

  /** 0 = acaba de moverse, 1 = ya puede moverse. */
  readiness(playerId: string): number {
    return this.humans.find((h) => h.id === playerId)?.readiness(this.clock.now()) ?? 1;
  }

  /** Avisa cada vez que cambia algo visible. Devuelve la función para dejar de escuchar. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Abre la partida (eventos de inicio y ruta óptima de cada jugador), hace la
   * cuenta regresiva y lanza a la IA. Vuelve cuando ya se puede jugar.
   */
  async begin(): Promise<void> {
    if (this.currentPhase !== "preparing") return;
    this.events.matchStarted({
      board: this.board,
      lives: this.humans[0]?.lives ?? 0,
      mode: this.mode,
      humanCooldownMs: this.humans[0]?.cooldownMs ?? HUMAN_COOLDOWN_MS,
      ...(this.difficulty && this.cpu
        ? { difficulty: this.difficulty, cpuIntervalMs: DIFFICULTIES[this.difficulty].cpuIntervalMs }
        : {}),
    });
    for (const racer of this.racers) this.events.playerJoined(racer.id);
    for (const racer of this.racers) {
      this.events.routeComputed(racer.id, this.board.start, this.board.exit, this.route);
    }

    this.currentPhase = "countdown";
    this.goAt = this.clock.now() + this.countdownMs;
    this.notify();
    try {
      await this.clock.sleep(this.countdownMs, this.abortController.signal);
    } catch (error) {
      if (this.isFinished()) return; // se cerró durante la cuenta regresiva
      throw error;
    }
    if (this.isFinished()) return;

    this.currentPhase = "playing";
    this.startedAt = this.clock.now();
    this.notify();
    if (this.cpu) void this.runCpu(this.cpu).catch((error: unknown) => this.fail(error));
  }

  /** Jugada de una persona. Se ignora si todavía está en espera (cooldown). */
  moveHuman(playerId: string, direction: Direction): MoveResult {
    const human = this.humans.find((h) => h.id === playerId);
    if (!human || this.currentPhase !== "playing" || human.isEliminated) return "ignored";
    const now = this.clock.now();
    if (!human.isReady(now)) return "cooldown";

    const result = this.step(human, direction);
    if (result !== "edge") human.markAction(now); // contra el borde no se castiga con espera
    return result;
  }

  /** Se cierra la partida (si ya había empezado, con MATCH_FINISHED y sin ganador). */
  abandon(): void {
    this.finish({ kind: "abandoned" });
  }

  /** La IA: en cada ciclo pregunta a Prolog y espera su intervalo a la vez, y luego mueve. */
  private async runCpu(cpu: CpuRacer): Promise<void> {
    const signal = this.abortController.signal;
    while (!this.isFinished()) {
      const [direction] = await Promise.all([
        cpu.chooseMove(this.board, this.finder, signal),
        this.clock.sleep(cpu.intervalMs, signal),
      ]);
      if (this.isFinished() || direction === null) continue;

      const next = cpu.position.step(direction);
      if (!this.board.inBounds(next) || this.board.isObstacle(next)) {
        throw new Error(`Prolog devolvió una jugada inválida para la IA: ${direction}`);
      }
      this.step(cpu, direction);
    }
  }

  /** Aplica un paso (de persona o IA). Es lo único que cambia posiciones y manda eventos de juego. */
  private step(racer: Racer, direction: Direction): MoveResult {
    const next = racer.position.step(direction);
    if (!this.board.inBounds(next)) return "edge";

    if (this.board.isObstacle(next)) {
      const left = racer.loseLife();
      this.events.obstacleHit(racer.id, next, left);
      if (left > 0) {
        this.notify();
        return "hit";
      }
      if (this.racers.every((r) => r.isEliminated)) this.finish({ kind: "all-eliminated" });
      else this.notify();
      return "eliminated";
    }

    const { position, turn } = racer.advance(direction);
    this.events.moved(racer.id, position, direction, turn);
    if (position.equals(this.board.exit)) {
      this.events.targetReached(racer.id, racer.steps, racer.turns);
      this.finish({ kind: "won", winnerId: racer.id });
      return "reached";
    }
    this.notify();
    return "moved";
  }

  private fail(error: unknown): void {
    if (this.isFinished()) return; // era solo la cancelación de la espera a Prolog
    this.failure = error instanceof Error ? error : new Error(String(error));
    this.finish({ kind: "abandoned" });
  }

  private finish(outcome: Outcome): void {
    if (this.isFinished()) return;
    const hadStarted = this.currentPhase !== "preparing";
    this.currentPhase = "finished";
    this.currentOutcome = outcome;
    this.finishedAt = this.clock.now();
    // Una partida que nunca abrió (sin MATCH_STARTED) tampoco se cierra con evento.
    if (hadStarted) this.events.matchFinished(outcome.kind === "won" ? outcome.winnerId : undefined);
    this.abortController.abort(); // cancela lo que siga esperando (cuenta regresiva, Prolog)
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
