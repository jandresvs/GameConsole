import type { Board } from "./Board.ts";
import type { ChaseEvents } from "./ChaseEvents.ts";
import type { Direction } from "./Direction.ts";
import type { Difficulty } from "./Pace.ts";
import type { CpuRacer, HumanRacer, Racer } from "./Racer.ts";
import type { Route, RouteFinder } from "./RouteFinder.ts";

export type Mode = "vs-cpu" | "vs-human";
export type Phase = "ready" | "countdown" | "playing" | "finished";

export type Outcome =
  | { kind: "won"; winnerId: string }
  | { kind: "all-eliminated" }
  | { kind: "abandoned" };

/** Qué pasó con la jugada de una persona. */
export type MoveResult = "ignored" | "cooldown" | "edge" | "blocked" | "moved" | "hit" | "eliminated" | "reached";

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
  events: ChaseEvents;
  /** Cuenta regresiva antes de que todos puedan moverse. */
  countdownMs?: number;
}

/**
 * Las reglas de una partida de chase en tiempo real, sin nada de pantalla ni de relojes del sistema:
 * el tiempo avanza solo cuando el juego llama a `tick(dtMs)` (el reloj de la partida, que se detiene
 * si la pestaña está oculta). Por eso las pruebas corren partidas enteras sin esperar.
 *
 * Todos corren a la vez por el mismo mapa hacia la salida (en un borde). Una persona no puede moverse
 * más de una vez cada 0,5 s; la IA mueve sola cada cierto tiempo (según la dificultad) y en cada paso
 * le pregunta a Prolog por dónde ir. Chocar con un obstáculo cuesta una vida y la espera; sin vidas, esa
 * persona queda eliminada. Gana quien llega primero a la salida.
 */
export class ChaseMatch {
  readonly board: Board;
  readonly humans: readonly HumanRacer[];
  readonly cpu: CpuRacer | undefined;
  readonly difficulty: Difficulty | undefined;

  private readonly route: Route;
  private readonly finder: RouteFinder;
  private readonly events: ChaseEvents;
  private readonly abortController = new AbortController();
  private currentPhase: Phase = "ready";
  private currentOutcome: Outcome | null = null;
  private failure: Error | null = null;
  private countdownLeft: number;
  private playedMs = 0;

  constructor(opts: ChaseMatchOptions) {
    this.board = opts.board;
    this.route = opts.route;
    this.humans = opts.humans;
    this.cpu = opts.cpu;
    this.difficulty = opts.difficulty;
    this.finder = opts.finder;
    this.events = opts.events;
    this.countdownLeft = opts.countdownMs ?? 3000;

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
  get countdownLeftMs(): number {
    return this.currentPhase === "countdown" ? Math.max(0, this.countdownLeft) : 0;
  }

  /** Tiempo de juego transcurrido desde que terminó la cuenta regresiva. */
  get elapsedMs(): number {
    return this.playedMs;
  }

  /** Abre la partida: la ruta óptima de cada jugador (calculada por Prolog) y la cuenta regresiva. */
  begin(): void {
    if (this.currentPhase !== "ready") return;
    for (const racer of this.racers) {
      this.events.routeComputed(racer.id, this.board.start, this.board.exit, this.route);
    }
    this.currentPhase = "countdown";
  }

  /** Avanza el reloj de la partida `dtMs`. Lo llama el juego en cada cuadro. */
  tick(dtMs: number): void {
    if (this.currentPhase === "countdown") {
      this.countdownLeft -= dtMs;
      if (this.countdownLeft <= 0) this.currentPhase = "playing";
      return;
    }
    if (this.currentPhase !== "playing") return;

    this.playedMs += dtMs;
    for (const human of this.humans) human.tick(dtMs);

    const cpu = this.cpu;
    if (!cpu) return;
    try {
      const direction = cpu.think(dtMs, () => cpu.chooseMove(this.board, this.finder, this.abortController.signal));
      if (direction === null) return;
      const next = cpu.position.step(direction);
      if (!this.board.inBounds(next) || this.board.isObstacle(next)) {
        throw new Error(`Prolog devolvió una jugada inválida para la IA: ${direction}`);
      }
      this.step(cpu, direction);
    } catch (error) {
      this.fail(error);
    }
  }

  /** Jugada de una persona. Se ignora si todavía está en espera (cooldown). */
  moveHuman(playerId: string, direction: Direction): MoveResult {
    const human = this.humans.find((h) => h.id === playerId);
    if (!human || this.currentPhase !== "playing" || human.isEliminated) return "ignored";
    if (!human.isReady) return "cooldown";

    const result = this.step(human, direction);
    if (result !== "edge") human.startCooldown(); // contra el borde del mapa no se castiga con espera
    return result;
  }

  /**
   * Movimiento por tecla mantenida: igual que moveHuman, pero nunca choca solo. Si adelante hay un
   * obstáculo no hace nada: un choque tiene que ser una pulsación deliberada, no dejar la tecla apretada.
   */
  holdHuman(playerId: string, direction: Direction): MoveResult {
    const human = this.humans.find((h) => h.id === playerId);
    if (!human || this.currentPhase !== "playing" || human.isEliminated) return "ignored";
    if (this.board.isObstacle(human.position.step(direction))) return "blocked";
    return this.moveHuman(playerId, direction);
  }

  /** Se cierra la partida (la clase base ya emitió PLAYER_LEFT y MATCH_FINISHED) y se cancela lo que espere a Prolog. */
  abandon(): void {
    this.finish({ kind: "abandoned" });
  }

  /** Aplica un paso (de persona o IA). Es lo único que cambia posiciones y emite eventos de juego. */
  private step(racer: Racer, direction: Direction): MoveResult {
    const next = racer.position.step(direction);
    if (!this.board.inBounds(next)) return "edge";

    if (this.board.isObstacle(next)) {
      const left = racer.loseLife();
      this.events.obstacleHit(racer.id, next, left);
      if (left > 0) return "hit";
      if (this.racers.every((r) => r.isEliminated)) this.finish({ kind: "all-eliminated" });
      return "eliminated";
    }

    const { position, turn } = racer.advance(direction);
    this.events.moved(racer.id, position, direction, turn);
    if (position.equals(this.board.exit)) {
      this.events.targetReached(racer.id, racer.steps, racer.turns);
      this.finish({ kind: "won", winnerId: racer.id });
      return "reached";
    }
    return "moved";
  }

  private fail(error: unknown): void {
    if (this.isFinished()) return; // era solo la cancelación de la espera a Prolog
    this.failure = error instanceof Error ? error : new Error(String(error));
    this.finish({ kind: "abandoned" });
  }

  private finish(outcome: Outcome): void {
    if (this.isFinished()) return;
    this.currentPhase = "finished";
    this.currentOutcome = outcome;
    this.abortController.abort(); // cancela lo que siga esperando a Prolog
    // El ganador (si hay) pasa al juego, que cierra la partida con MATCH_FINISHED. Si la partida ya
    // la cerró la clase base (se abandonó desde afuera), este aviso no emite nada más.
    this.events.matchFinished(outcome.kind === "won" ? outcome.winnerId : undefined);
  }

  /** Método y no comparación directa: tras cada await la fase pudo cambiar y TypeScript no lo sabe. */
  private isFinished(): boolean {
    return this.currentPhase === "finished";
  }
}
