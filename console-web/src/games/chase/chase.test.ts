import { describe, expect, it } from "vitest";
<<<<<<< Updated upstream
import type { EventSink, GameEvent } from "../../events/GameEvent.ts";
import { MatchEvents } from "../../events/MatchEvents.ts";
import { Board } from "./Board.ts";
import { ChaseEvents } from "./ChaseEvents.ts";
import { ChaseMatch } from "./ChaseMatch.ts";
import type { Direction } from "./Direction.ts";
import { PrologRouteFinder } from "./PrologRouteFinder.ts";
import { CpuRacer, HumanRacer } from "./Racer.ts";
import { Position } from "./Position.ts";
import type { Route, RouteFinder } from "./RouteFinder.ts";

// ---- Apoyos ----------------------------------------------------------------

/**
 * Las pruebas se escribieron con node:assert; este adaptador las corre en
 * Vitest (el marco de pruebas del proyecto) sin cambiar cada verificación.
 */
const assert = {
  equal: (actual: unknown, expected: unknown, message?: string) => expect(actual, message).toBe(expected),
  deepEqual: (actual: unknown, expected: unknown, message?: string) => expect(actual, message).toStrictEqual(expected),
  ok: (value: unknown, message?: string) => expect(value, message).toBeTruthy(),
  match: (value: string, pattern: RegExp, message?: string) => expect(value, message).toMatch(pattern),
  throws: (fn: () => unknown, error: new (...args: never[]) => Error) => expect(fn).toThrow(error),
  rejects: async (promise: Promise<unknown>) => {
    await expect(promise).rejects.toBeTruthy();
  },
};

class Recorder implements EventSink {
  readonly events: GameEvent[] = [];
  send(event: GameEvent): void {
    this.events.push(event);
  }
  types(): string[] {
    return this.events.map((e) => e.type);
  }
}

/** Reemplazo de Prolog en las pruebas: BFS (ruta más corta; el A* real se prueba en ai-prolog/). */
=======
import { Board } from "./Board.ts";
import { ChaseEvents } from "./ChaseEvents.ts";
import { ChaseMatch } from "./ChaseMatch.ts";
import { chaseFollowUps, parseChaseSettings, secondPlayerId } from "./ChaseSettings.ts";
import { type Direction, deltaOf, DIRECTIONS } from "./Direction.ts";
import { LEVELS, levelInfo, nextLevel } from "./Levels.ts";
import { MapBuilder } from "./MapBuilder.ts";
import { DIFFICULTIES, HUMAN_COOLDOWN_MS } from "./Pace.ts";
import { Position } from "./Position.ts";
import { CpuRacer, HumanRacer } from "./Racer.ts";
import type { Route, RouteFinder } from "./RouteFinder.ts";
import { EXIT_GATE, KNIGHT_CPU, KNIGHT_PLAYER2, KNIGHT_USER } from "./sprites.ts";

/** Buscador de rutas de mentira (BFS) para probar sin Prolog. */
>>>>>>> Stashed changes
class BfsFinder implements RouteFinder {
  calls = 0;
  async findRoute(board: Board, from: Position): Promise<Route> {
    this.calls++;
<<<<<<< Updated upstream
    const dirs: Direction[] = ["arriba", "abajo", "izquierda", "derecha"];
    const prev = new Map<string, { from: Position; dir: Direction } | null>([[from.key(), null]]);
    const queue = [from];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.equals(board.target)) break;
      for (const dir of dirs) {
        const next = cur.step(dir);
=======
    const prev = new Map<string, { from: Position; dir: Direction } | null>([[from.key(), null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.equals(board.exit)) break;
      for (const dir of DIRECTIONS) {
        const [dr, dc] = deltaOf(dir);
        const next = new Position(cur.row + dr, cur.col + dc);
>>>>>>> Stashed changes
        if (!board.inBounds(next) || board.isObstacle(next) || prev.has(next.key())) continue;
        prev.set(next.key(), { from: cur, dir });
        queue.push(next);
      }
    }
<<<<<<< Updated upstream
    if (!prev.has(board.target.key())) return { found: false, steps: 0, turns: 0, path: [] };
    const path: { row: number; col: number; direction: Direction }[] = [];
    for (let p = board.target; prev.get(p.key()); p = prev.get(p.key())!.from) {
      path.unshift({ row: p.row, col: p.col, direction: prev.get(p.key())!.dir });
    }
    let turns = 0;
    for (let i = 1; i < path.length; i++) if (path[i]!.direction !== path[i - 1]!.direction) turns++;
    return { found: true, steps: path.length, turns, path };
  }
}

const P = (r: number, c: number) => new Position(r, c);
const noPause = async () => {};

/**
 * Arma una partida como lo hace ChaseGame: los eventos pasan por MatchEvents
 * (el mismo que usa la clase base Game) y, como hace la base al empezar, se
 * emiten MATCH_STARTED y un PLAYER_JOINED por jugador antes de begin().
 */
function setup(opts: {
  board: Board;
  user: Position;
  cpu: Position;
  finder?: RouteFinder;
  lives?: number;
  matchId?: string;
  sender?: Recorder;
}) {
  const sender = opts.sender ?? new Recorder();
  const lives = opts.lives ?? 3;
  const log = new MatchEvents("chase", opts.matchId ?? "chase-prueba", "1.0", sender);
  const { board } = opts;
  log.add("MATCH_STARTED", { rows: board.rows, cols: board.cols, obstaclePct: board.obstaclePct, lives });
  log.add("PLAYER_JOINED", undefined, "ana");
  log.add("PLAYER_JOINED", undefined, "cpu");

  const match = new ChaseMatch({
    board,
    user: new HumanRacer("ana", opts.user, lives),
    cpu: new CpuRacer("cpu", opts.cpu, lives),
    finder: opts.finder ?? new BfsFinder(),
    events: new ChaseEvents(
      (type, data, playerId) => {
        if (!log.isClosed) log.add(type, data, playerId); // como this.emit: nada después de terminar
      },
      (winnerId) => log.finish(winnerId),
    ),
    pause: noPause,
  });
  return { match, sender };
}

/** Reglas del contrato de GameStats que cualquier evento debe cumplir. */
function assertValidContract(events: GameEvent[]): void {
  const ids = new Set<string>();
  for (const e of events) {
    assert.ok(e.eventId && !ids.has(e.eventId), "eventId único");
    ids.add(e.eventId);
    assert.match(e.timestamp, /^\d{4}-\d\d-\d\dT[\d:.]+Z$/, "timestamp UTC con Z");
    assert.equal(e.gameId, "chase");
    assert.match(e.type, /^[A-Z_]+$/);
    if (e.type === "MATCH_STARTED" || e.type === "MATCH_FINISHED") assert.equal(e.playerId, undefined);
    else assert.ok(e.playerId, `${e.type} lleva playerId`);
  }
  const finished = events.map((e) => e.type).indexOf("MATCH_FINISHED");
  if (finished >= 0) assert.equal(finished, events.length - 1, "MATCH_FINISHED es el último");
  assert.equal(new Set(events.map((e) => e.matchId)).size, 1, "un solo matchId");
}

// ---- Tablero ---------------------------------------------------------------

describe("Board.generate", () => {
  it("coloca meta, usuario y CPU en celdas distintas y sin obstáculos", () => {
    for (let i = 0; i < 50; i++) {
      const { board, userStart, cpuStart } = Board.generate(6, 8, 30);
      const cells = [board.target, userStart, cpuStart].map((p) => p.key());
      assert.equal(new Set(cells).size, 3);
      for (const p of [board.target, userStart, cpuStart]) assert.equal(board.isObstacle(p), false);
      assert.equal(board.obstacleList().length, Math.floor((6 * 8 * 30) / 100));
    }
  });

  it("con el mismo generador al azar da el mismo tablero", () => {
    const seq = () => {
      let n = 7;
      return () => ((n = (n * 16807) % 2147483647) / 2147483647);
    };
    const a = Board.generate(5, 5, 20, seq());
    const b = Board.generate(5, 5, 20, seq());
    assert.deepEqual(a.board.obstacleList(), b.board.obstacleList());
  });

  it("rechaza tamaños y porcentajes absurdos", () => {
    assert.throws(() => Board.generate(1, 5, 10), RangeError);
    assert.throws(() => Board.generate(5, 5, 90), RangeError);
  });
});

// ---- Racer -----------------------------------------------------------------

describe("Racer", () => {
  it("cuenta pasos y giros; el primer paso no es giro", () => {
    const r = new HumanRacer("ana", P(0, 0), 3);
    assert.equal(r.advance("derecha").turn, false);
    assert.equal(r.advance("derecha").turn, false);
    assert.equal(r.advance("abajo").turn, true);
    assert.equal(r.steps, 3);
    assert.equal(r.turns, 1);
    assert.ok(r.position.equals(P(1, 2)));
  });

  it("las vidas no bajan de cero", () => {
    const r = new HumanRacer("ana", P(0, 0), 1);
    assert.equal(r.loseLife(), 0);
    assert.equal(r.loseLife(), 0);
  });
});

// ---- Partida ---------------------------------------------------------------

describe("ChaseMatch", () => {
  it("el usuario llega primero: eventos en orden y ganador", async () => {
    const { match, sender } = setup({ board: new Board(1, 5, [], P(0, 4)), user: P(0, 2), cpu: P(0, 0) });
    await match.begin();
    assert.equal(match.phase, "playing");
    assert.equal(await match.userMove("derecha"), "moved");
    assert.equal(await match.userMove("derecha"), "reached");

    assert.deepEqual(sender.types(), [
      "MATCH_STARTED", "PLAYER_JOINED", "PLAYER_JOINED", "ROUTE_COMPUTED", "ROUTE_COMPUTED",
      "PLAYER_MOVED", "PLAYER_MOVED", "PLAYER_MOVED", "TARGET_REACHED", "MATCH_FINISHED",
    ]);
    const last = sender.events.at(-1)!;
    assert.deepEqual(last.data, { winnerId: "ana" });
    assert.equal(match.outcome?.kind, "won");
    assertValidContract(sender.events);
  });

  it("la CPU recuerda lo que le falta de su ruta (para dibujarla) y lo va consumiendo", async () => {
    const { match } = setup({ board: new Board(1, 6, [], P(0, 5)), user: P(0, 0), cpu: P(0, 2) });
    await match.begin();
    assert.deepEqual(match.cpu.route.map((p) => p.key()), ["0,3", "0,4", "0,5"]);
    await match.userMove("derecha"); // después mueve la CPU un paso
    assert.deepEqual(match.cpu.route.map((p) => p.key()), ["0,4", "0,5"]);
  });

  it("ROUTE_COMPUTED trae los datos del contrato", async () => {
    const { match, sender } = setup({ board: new Board(1, 5, [], P(0, 4), 0), user: P(0, 0), cpu: P(0, 2) });
    await match.begin();
    const route = sender.events.find((e) => e.type === "ROUTE_COMPUTED" && e.playerId === "ana")!;
    assert.deepEqual(route.data, {
      found: true, start: { row: 0, col: 0 }, goal: { row: 0, col: 4 }, optimalSteps: 4, routeTurns: 0,
    });
  });

  it("la CPU gana si llega antes; su jugada sale del buscador de rutas", async () => {
    const finder = new BfsFinder();
    const { match, sender } = setup({ board: new Board(1, 6, [], P(0, 5)), user: P(0, 0), cpu: P(0, 3), finder });
    await match.begin();
    const callsAfterBegin = finder.calls; // una por jugador
    await match.userMove("derecha");
    await match.userMove("derecha");
    assert.equal(match.outcome?.kind, "won");
    assert.deepEqual(sender.events.at(-1)!.data, { winnerId: "cpu" });
    assert.ok(finder.calls > callsAfterBegin, "la CPU consultó la ruta en cada turno");
    assert.ok(sender.events.some((e) => e.type === "TARGET_REACHED" && e.playerId === "cpu"));
    assertValidContract(sender.events);
  });

  it("chocar con un obstáculo cuesta una vida y el turno; sin vidas termina sin ganador", async () => {
    // La CPU está a 3 pasos de La Mala: no alcanza a llegar mientras el usuario choca 3 veces.
    const board = new Board(4, 4, [P(0, 1), P(1, 0)], P(3, 3));
    const { match, sender } = setup({ board, user: P(1, 1), cpu: P(3, 0), lives: 3 });
    await match.begin();
    assert.equal(await match.userMove("arriba"), "hit");
    assert.equal(await match.userMove("izquierda"), "hit");
    assert.equal(match.user.lives, 1);
    assert.equal(await match.userMove("arriba"), "out-of-lives");

    const hits = sender.events.filter((e) => e.type === "OBSTACLE_HIT");
    assert.deepEqual(hits.map((h) => (h.data as { livesLeft: number }).livesLeft), [2, 1, 0]);
    assert.equal(match.outcome?.kind, "out-of-lives");
    assert.equal(sender.events.at(-1)!.data, undefined, "sin winnerId");
    assert.equal(await match.userMove("abajo"), "ignored", "terminada: no acepta jugadas");
    assertValidContract(sender.events);
  });

  it("los choques no cuentan como pasos", async () => {
    const board = new Board(2, 3, [P(0, 1)], P(1, 2));
    const { match, sender } = setup({ board, user: P(0, 0), cpu: P(1, 0) });
    await match.begin();
    await match.userMove("derecha"); // choca
    assert.equal(match.user.steps, 0);
    assert.equal(sender.events.filter((e) => e.type === "PLAYER_MOVED" && e.playerId === "ana").length, 0);
  });

  it("contra el borde no pasa nada: ni evento ni turno de la CPU", async () => {
    const finder = new BfsFinder();
    const { match, sender } = setup({ board: new Board(2, 2, [], P(1, 1)), user: P(0, 0), cpu: P(1, 0), finder });
    await match.begin();
    const before = sender.events.length;
    const calls = finder.calls;
    assert.equal(await match.userMove("arriba"), "edge");
    assert.equal(sender.events.length, before);
    assert.equal(finder.calls, calls);
    assert.equal(match.phase, "playing");
  });

  it("tablero sin ruta: ROUTE_COMPUTED found=false y termina sin ganador", async () => {
    const board = new Board(1, 3, [P(0, 1)], P(0, 2));
    const { match, sender } = setup({ board, user: P(0, 0), cpu: P(0, 0) });
    await match.begin();
    assert.equal(match.outcome?.kind, "no-route");
    const route = sender.events.find((e) => e.type === "ROUTE_COMPUTED")!;
    assert.equal((route.data as { found: boolean }).found, false);
    assert.equal(sender.types().at(-1), "MATCH_FINISHED");
    assertValidContract(sender.events);
  });

  it("abandonar a mitad cierra la partida una sola vez", async () => {
    const { match, sender } = setup({ board: new Board(1, 5, [], P(0, 4)), user: P(0, 0), cpu: P(0, 1) });
    await match.begin();
    match.abandon();
    match.abandon();
    assert.equal(sender.types().filter((t) => t === "MATCH_FINISHED").length, 1);
    assertValidContract(sender.events);
  });

  it("abandonar mientras espera a Prolog cancela la espera sin error", async () => {
    const pending: RouteFinder = {
      findRoute: (_b, _f, signal) =>
        new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(signal.reason))),
    };
    const { match, sender } = setup({ board: new Board(1, 5, [], P(0, 4)), user: P(0, 0), cpu: P(0, 1), finder: pending });
    const begin = match.begin();
    match.abandon();
    await begin; // no lanza
    assert.equal(match.outcome?.kind, "abandoned");
    assert.equal(sender.types().at(-1), "MATCH_FINISHED");
  });

  it("dos partidas a la vez no mezclan sus eventos", async () => {
    const sender = new Recorder(); // el MISMO destino para las dos, como en la consola
    const mk = (matchId: string) =>
      setup({ board: new Board(1, 6, [], P(0, 5)), user: P(0, 0), cpu: P(0, 2), matchId, sender }).match;
    const a = mk("chase-A");
    const b = mk("chase-B");
    await Promise.all([a.begin(), b.begin()]);
    for (let i = 0; i < 3; i++) await Promise.all([a.userMove("derecha"), b.userMove("derecha")]);

    for (const id of ["chase-A", "chase-B"]) {
      const mine = sender.events.filter((e) => e.matchId === id);
      assert.equal(mine.filter((e) => e.type === "MATCH_FINISHED").length, 1);
      assertValidContract(mine);
    }
    assert.equal(new Set(sender.events.map((e) => e.eventId)).size, sender.events.length);
  });
});

// ---- Cliente de Prolog -----------------------------------------------------

describe("PrologRouteFinder", () => {
  const board = new Board(3, 3, [P(1, 1)], P(2, 2));
  const okBody = { found: true, steps: 1, turns: 0, path: [{ row: 0, col: 1, direction: "derecha" }] };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("manda el tablero completo en el formato del contrato", async () => {
    let sent: any;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return json(okBody);
    }) as unknown as typeof fetch;
    const finder = new PrologRouteFinder({ baseUrl: "/api/prolog", fetchFn });
    const route = await finder.findRoute(board, P(0, 0));
    assert.deepEqual(sent, {
      rows: 3, cols: 3, obstacles: [{ row: 1, col: 1 }], from: { row: 0, col: 0 }, goal: { row: 2, col: 2 },
    });
    assert.equal(route.path[0]!.direction, "derecha");
  });

  it("si Prolog no responde, avisa y reintenta hasta que conteste", async () => {
    let calls = 0;
    const unavailable: number[] = [];
    let recovered = 0;
    const fetchFn = (async () => {
      calls++;
      if (calls === 1) throw new TypeError("network down");
      if (calls === 2) return json({ error: "servicio no disponible" }, 502);
      return json(okBody);
    }) as unknown as typeof fetch;
    const finder = new PrologRouteFinder({
      baseUrl: "/api/prolog",
      fetchFn,
      sleep: async () => {},
      onUnavailable: (n) => unavailable.push(n),
      onRecovered: () => recovered++,
    });
    const route = await finder.findRoute(board, P(0, 0));
    assert.equal(calls, 3);
    assert.deepEqual(unavailable, [1, 2]);
    assert.equal(recovered, 1);
    assert.equal(route.found, true);
  });

  it("un 400 o una respuesta inservible NO se reintenta", async () => {
    let calls = 0;
    const bad = (async () => (calls++, json({ error: "celda fuera del tablero" }, 400))) as unknown as typeof fetch;
    await assert.rejects(new PrologRouteFinder({ baseUrl: "", fetchFn: bad, sleep: async () => {} }).findRoute(board, P(0, 0)));
    assert.equal(calls, 1);

    const junk = (async () => json({ hola: 1 })) as unknown as typeof fetch;
    await assert.rejects(new PrologRouteFinder({ baseUrl: "", fetchFn: junk, sleep: async () => {} }).findRoute(board, P(0, 0)));
  });

  it("cancelar la señal corta los reintentos", async () => {
    const controller = new AbortController();
    const fetchFn = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const finder = new PrologRouteFinder({
      baseUrl: "",
      fetchFn,
      sleep: async () => controller.abort(),
    });
    await assert.rejects(finder.findRoute(board, P(0, 0), controller.signal));
  });

  it("found=false se devuelve como ruta vacía", async () => {
    const fetchFn = (async () => json({ found: false })) as unknown as typeof fetch;
    const route = await new PrologRouteFinder({ baseUrl: "", fetchFn }).findRoute(board, P(0, 0));
    assert.deepEqual(route, { found: false, steps: 0, turns: 0, path: [] });
=======
    if (!prev.has(board.exit.key())) return { found: false, steps: 0, turns: 0, path: [] };
    const path: Route["path"][number][] = [];
    for (let p: Position = board.exit; prev.get(p.key()); ) {
      const link = prev.get(p.key())!;
      path.unshift({ row: p.row, col: p.col, direction: link.dir });
      p = link.from;
    }
    return { found: true, steps: path.length, turns: 0, path };
  }
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

interface Emitted {
  type: string;
  data?: Record<string, unknown>;
  playerId?: string;
}

function setup(opts: { mode: "vs-cpu" | "vs-human"; obstacles?: Position[]; difficulty?: "facil" | "experto" }) {
  const board = new Board(5, 5, opts.obstacles ?? [], new Position(2, 0), new Position(2, 4));
  const finder = new BfsFinder();
  const emitted: Emitted[] = [];
  const finished: (string | undefined)[] = [];
  const humans = [new HumanRacer("ana", board.start, 3)];
  if (opts.mode === "vs-human") humans.push(new HumanRacer("jugador-2", board.start, 3));
  const diff = opts.difficulty ?? "facil";
  const cpu = opts.mode === "vs-cpu" ? new CpuRacer("cpu", board.start, 3, DIFFICULTIES[diff].cpuIntervalMs) : undefined;
  const route: Route = {
    found: true,
    steps: 4,
    turns: 0,
    path: [1, 2, 3, 4].map((c) => ({ row: 2, col: c, direction: "derecha" as Direction })),
  };
  const match = new ChaseMatch({
    board,
    route,
    humans,
    cpu,
    difficulty: cpu ? diff : undefined,
    finder,
    events: new ChaseEvents(
      (type, data, playerId) => emitted.push({ type, data: data as Record<string, unknown>, playerId }),
      (w) => finished.push(w),
    ),
  });
  return { board, match, emitted, finished, humans, cpu };
}

function startPlaying(m: ChaseMatch) {
  m.begin();
  m.tick(3100);
}

describe("Board", () => {
  it("rechaza una salida fuera del borde", () => {
    expect(() => new Board(5, 5, [], new Position(2, 0), new Position(2, 2))).toThrow();
  });
  it("genera mapas con salida en el borde, inicio lejos y sin obstáculos encima", () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 50; i++) {
      const b = Board.generate(10, 14, 22, random, 12);
      expect(b.isBorder(b.exit)).toBe(true);
      expect(b.isObstacle(b.exit)).toBe(false);
      expect(b.isObstacle(b.start)).toBe(false);
      expect(Math.abs(b.exit.row - b.start.row) + Math.abs(b.exit.col - b.start.col)).toBeGreaterThanOrEqual(12);
    }
  });
});

describe("MapBuilder", () => {
  it("entrega un mapa con ruta que pidió al buscador", async () => {
    const finder = new BfsFinder();
    const built = await new MapBuilder(finder).build({ rows: 10, cols: 14, obstaclePct: 22, minSteps: 12 });
    expect(built.route.found).toBe(true);
    expect(built.route.steps).toBeGreaterThanOrEqual(12);
    expect(finder.calls).toBeGreaterThan(0);
  });
});

describe("HumanRacer", () => {
  it("espera 0,5 s entre movimientos según el reloj de la partida", () => {
    const h = new HumanRacer("a", new Position(0, 0), 3);
    expect(h.isReady).toBe(true);
    h.startCooldown();
    expect(h.isReady).toBe(false);
    h.tick(HUMAN_COOLDOWN_MS - 1);
    expect(h.isReady).toBe(false);
    h.tick(1);
    expect(h.isReady).toBe(true);
  });
});

describe("ChaseMatch humano", () => {
  it("no deja moverse durante la cuenta regresiva", () => {
    const { match } = setup({ mode: "vs-human" });
    match.begin();
    expect(match.moveHuman("ana", "derecha")).toBe("ignored");
  });

  it("limita a un movimiento cada 0,5 s", () => {
    const { match } = setup({ mode: "vs-human" });
    startPlaying(match);
    expect(match.moveHuman("ana", "derecha")).toBe("moved");
    expect(match.moveHuman("ana", "derecha")).toBe("cooldown");
    match.tick(499);
    expect(match.moveHuman("ana", "derecha")).toBe("cooldown");
    match.tick(1);
    expect(match.moveHuman("ana", "derecha")).toBe("moved");
  });

  it("chocar con un obstáculo cuesta una vida y el borde del mapa no", () => {
    const { match, humans } = setup({ mode: "vs-human", obstacles: [new Position(2, 1)] });
    startPlaying(match);
    expect(match.moveHuman("ana", "izquierda")).toBe("edge");
    expect(humans[0].lives).toBe(3);
    expect(match.moveHuman("ana", "derecha")).toBe("hit");
    expect(humans[0].lives).toBe(2);
  });

  it("la tecla mantenida nunca choca sola", () => {
    const { match, humans } = setup({ mode: "vs-human", obstacles: [new Position(2, 1)] });
    startPlaying(match);
    expect(match.holdHuman("ana", "derecha")).toBe("blocked");
    expect(humans[0].lives).toBe(3);
  });

  it("gana quien llega primero a la salida y MATCH_FINISHED lo informa", () => {
    const { match, finished, emitted } = setup({ mode: "vs-human" });
    startPlaying(match);
    for (let i = 0; i < 4; i++) {
      match.moveHuman("jugador-2", "derecha");
      match.tick(500);
    }
    expect(match.phase).toBe("finished");
    expect(finished).toEqual(["jugador-2"]);
    expect(emitted.filter((e) => e.type === "TARGET_REACHED")).toHaveLength(1);
    expect(match.outcome).toMatchObject({ kind: "won", winnerId: "jugador-2" });
  });

  it("sin vidas todos: nadie gana", () => {
    const obstacles = [new Position(1, 0), new Position(3, 0), new Position(2, 1)];
    const { match, finished } = setup({ mode: "vs-human", obstacles });
    startPlaying(match);
    for (let i = 0; i < 3; i++) {
      for (const id of ["ana", "jugador-2"]) match.moveHuman(id, "derecha");
      match.tick(500);
    }
    expect(match.outcome?.kind).toBe("all-eliminated");
    expect(finished).toEqual([undefined]);
  });
});

describe("ChaseMatch contra la IA", () => {
  it("la IA llega a la salida sola, sin chocar, a su ritmo", async () => {
    const { match, finished, humans } = setup({ mode: "vs-cpu" });
    startPlaying(match);
    let ms = 0;
    while (match.phase === "playing" && ms < 60000) {
      match.tick(100);
      ms += 100;
      await flush();
    }
    expect(finished).toEqual(["cpu"]);
    expect(match.cpu!.lives).toBe(3);
    expect(humans[0].lives).toBe(3);
    expect(ms).toBeGreaterThanOrEqual(4 * DIFFICULTIES.facil.cpuIntervalMs - 200);
  });

  it("mayor dificultad = IA más rápida", () => {
    const order = LEVELS.map((l) => DIFFICULTIES[l].cpuIntervalMs);
    expect([...order].sort((a, b) => b - a)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
  });

  it("el humano puede ganarle a la IA lenta", () => {
    const { match, finished } = setup({ mode: "vs-cpu" });
    startPlaying(match);
    for (let i = 0; i < 4; i++) {
      match.moveHuman("ana", "derecha");
      match.tick(500);
    }
    expect(finished).toEqual(["ana"]);
  });

  it("abandonar cierra la partida una sola vez", () => {
    const { match, finished } = setup({ mode: "vs-cpu" });
    startPlaying(match);
    match.abandon();
    match.abandon();
    expect(match.outcome?.kind).toBe("abandoned");
    expect(finished.length).toBeLessThanOrEqual(1);
  });
});

describe("eventos", () => {
  it("emite ROUTE_COMPUTED para cada jugador y PLAYER_MOVED con el playerId", () => {
    const { match, emitted } = setup({ mode: "vs-human" });
    match.begin();
    const routes = emitted.filter((e) => e.type === "ROUTE_COMPUTED");
    expect(routes.map((r) => r.playerId).sort()).toEqual(["ana", "jugador-2"]);
    match.tick(3100);
    match.moveHuman("ana", "derecha");
    const moved = emitted.find((e) => e.type === "PLAYER_MOVED");
    expect(moved?.playerId).toBe("ana");
  });

  it("dos partidas a la vez no comparten estado", () => {
    const a = setup({ mode: "vs-human" });
    const b = setup({ mode: "vs-human" });
    startPlaying(a.match);
    startPlaying(b.match);
    a.match.moveHuman("ana", "derecha");
    expect(a.humans[0].position.col).toBe(1);
    expect(b.humans[0].position.col).toBe(0);
  });
});

describe("niveles y ajustes", () => {
  it("avanza de nivel y vuelve al primero tras el último", () => {
    expect(levelInfo("facil")).toMatchObject({ number: 1, total: 4, isLast: false });
    expect(nextLevel("facil")).toBe("normal");
    expect(levelInfo("experto").isLast).toBe(true);
    expect(nextLevel("experto")).toBe("facil");
  });

  it("valida los ajustes", () => {
    expect(parseChaseSettings({})).toEqual({ mode: "vs-cpu", difficulty: "facil" });
    expect(parseChaseSettings({ mode: "vs-human", difficulty: "x" }).mode).toBe("vs-human");
    expect(parseChaseSettings({ difficulty: "experto" }).difficulty).toBe("experto");
  });

  it("ofrece siguiente nivel al ganar y reintentar al perder", () => {
    const settings = { mode: "vs-cpu", difficulty: "facil" };
    const won = chaseFollowUps({ winnerId: "ana", abandoned: false } as never, settings, "ana");
    expect(won[0].primary).toBe(true);
    expect(won[0].settings.difficulty).toBe("normal");
    const lost = chaseFollowUps({ winnerId: "cpu", abandoned: false } as never, settings, "ana");
    expect(lost[0].settings.difficulty).toBe("facil");
    expect(lost[0].primary).toBe(true);
    expect(chaseFollowUps({ abandoned: true } as never, settings, "ana")).toEqual([]);
  });

  it("revancha en humano contra humano", () => {
    const r = chaseFollowUps({ winnerId: "ana", abandoned: false } as never, { mode: "vs-human" }, "ana");
    expect(r).toHaveLength(1);
    expect(r[0].label).toMatch(/Revancha/);
  });

  it("el segundo jugador nunca repite el id", () => {
    expect(secondPlayerId("ana")).toBe("jugador-2");
    expect(secondPlayerId("jugador-2")).toBe("jugador-2_2");
  });
});

describe("sprites", () => {
  it("son de 16×16", () => {
    for (const art of [KNIGHT_USER, KNIGHT_CPU, KNIGHT_PLAYER2, EXIT_GATE]) {
      const rows = (art as { rows?: readonly string[] }).rows ?? (art as unknown as readonly string[]);
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toHaveLength(16);
    }
>>>>>>> Stashed changes
  });
});
