import type { Board } from "./Board.ts";
import type { ChaseEvents } from "./ChaseEvents.ts";
import type { Direction } from "./Direction.ts";
<<<<<<< Updated upstream
import type { CpuRacer, HumanRacer } from "./Racer.ts";
import type { RouteFinder } from "./RouteFinder.ts";

export type Phase = "preparing" | "playing" | "cpu-turn" | "finished";
=======
import type { Difficulty } from "./Pace.ts";
import type { CpuRacer, HumanRacer, Racer } from "./Racer.ts";
import type { Route, RouteFinder } from "./RouteFinder.ts";

export type Mode = "vs-cpu" | "vs-human";
export type Phase = "ready" | "countdown" | "playing" | "finished";
>>>>>>> Stashed changes

export type Outcome =
  | { kind: "won"; winnerId: string }
  | { kind: "out-of-lives" }
  | { kind: "no-route" }
  | { kind: "abandoned" };

<<<<<<< Updated upstream
/** Qué pasó con la jugada del usuario. */
export type MoveResult = "ignored" | "edge" | "moved" | "hit" | "reached" | "out-of-lives";
=======
/** Qué pasó con la jugada de una persona. */
export type MoveResult = "ignored" | "cooldown" | "edge" | "blocked" | "moved" | "hit" | "eliminated" | "reached";
>>>>>>> Stashed changes

export interface ChaseMatchOptions {
  board: Board;
  user: HumanRacer;
  cpu: CpuRacer;
  finder: RouteFinder;
<<<<<<< Updated upstream
  /** A dónde van los eventos (ChaseGame los convierte en this.emit y finish). */
  events: ChaseEvents;
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
=======
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
>>>>>>> Stashed changes
 */
export class ChaseMatch {
  readonly board: Board;
  readonly user: HumanRacer;
  readonly cpu: CpuRacer;

  private readonly finder: RouteFinder;
  private readonly events: ChaseEvents;
<<<<<<< Updated upstream
  private readonly cpuDelayMs: number;
  private readonly pause: (ms: number) => Promise<void>;
=======
>>>>>>> Stashed changes
  private readonly abortController = new AbortController();
  private currentPhase: Phase = "ready";
  private currentOutcome: Outcome | null = null;
<<<<<<< Updated upstream
=======
  private failure: Error | null = null;
  private countdownLeft: number;
  private playedMs = 0;
>>>>>>> Stashed changes

  constructor(opts: ChaseMatchOptions) {
    this.board = opts.board;
    this.user = opts.user;
    this.cpu = opts.cpu;
    this.finder = opts.finder;
    this.events = opts.events;
<<<<<<< Updated upstream
    this.cpuDelayMs = opts.cpuDelayMs ?? 450;
    this.pause = opts.pause ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
=======
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
>>>>>>> Stashed changes
  }

  get phase(): Phase {
    return this.currentPhase;
  }

  get outcome(): Outcome | null {
    return this.currentOutcome;
  }

<<<<<<< Updated upstream
  /** Avisa cada vez que cambia algo visible. Devuelve la función para dejar de escuchar. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Abre la partida: ruta óptima de cada jugador (Prolog). MATCH_STARTED y
   * PLAYER_JOINED ya los emitió la clase base Game antes de llamar aquí.
   * Si Prolog no responde espera y reintenta; si el tablero no tiene ruta, la
   * partida termina sin ganador.
   */
  async begin(): Promise<void> {
    if (this.currentPhase !== "preparing") return;

    const signal = this.abortController.signal;
    try {
      const [userRoute, cpuRoute] = await Promise.all([
        this.finder.findRoute(this.board, this.user.position, signal),
        this.finder.findRoute(this.board, this.cpu.position, signal),
      ]);
      if (this.isFinished()) return;
      this.events.routeComputed(this.user.id, this.user.position, this.board.target, userRoute);
      this.events.routeComputed(this.cpu.id, this.cpu.position, this.board.target, cpuRoute);
      this.cpu.plan(cpuRoute);
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
=======
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
>>>>>>> Stashed changes
  abandon(): void {
    this.finish({ kind: "abandoned" });
  }

<<<<<<< Updated upstream
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
=======
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
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    this.events.matchFinished(outcome.kind === "won" ? outcome.winnerId : undefined);
    this.abortController.abort(); // cancela lo que siga esperando a Prolog
    this.notify();
=======
    this.abortController.abort(); // cancela lo que siga esperando a Prolog
    // El ganador (si hay) pasa al juego, que cierra la partida con MATCH_FINISHED. Si la partida ya
    // la cerró la clase base (se abandonó desde afuera), este aviso no emite nada más.
    this.events.matchFinished(outcome.kind === "won" ? outcome.winnerId : undefined);
>>>>>>> Stashed changes
  }

  /** Método y no comparación directa: tras cada await la fase pudo cambiar y TypeScript no lo sabe. */
  private isFinished(): boolean {
    return this.currentPhase === "finished";
  }
}
