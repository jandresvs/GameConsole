import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Board } from "../src/games/chase/Board.ts";
import { ChaseMatch } from "../src/games/chase/ChaseMatch.ts";
import type { Clock } from "../src/games/chase/Clock.ts";
import type { Direction } from "../src/games/chase/Direction.ts";
import { LEVELS, LevelProgress } from "../src/games/chase/Levels.ts";
import { MapBuilder } from "../src/games/chase/MapBuilder.ts";
import { DIFFICULTIES, HUMAN_COOLDOWN_MS, type Difficulty } from "../src/games/chase/Pace.ts";
import { Position } from "../src/games/chase/Position.ts";
import { PrologRouteFinder } from "../src/games/chase/PrologRouteFinder.ts";
import { CpuRacer, HumanRacer } from "../src/games/chase/Racer.ts";
import type { Route, RouteFinder } from "../src/games/chase/RouteFinder.ts";
import type { EventSender, GameEvent } from "../src/events/types.ts";

// ---- Apoyos ----------------------------------------------------------------

class Recorder implements EventSender {
  readonly events: GameEvent[] = [];
  send(event: GameEvent): void {
    this.events.push(event);
  }
  types(): string[] {
    return this.events.map((e) => e.type);
  }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Reloj controlado a mano: el tiempo solo avanza con advance(). */
class ManualClock implements Clock {
  private t = 0;
  private timers: { at: number; resolve: () => void; reject: (e: unknown) => void }[] = [];

  now(): number {
    return this.t;
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const timer = { at: this.t + ms, resolve, reject };
      this.timers.push(timer);
      signal?.addEventListener(
        "abort",
        () => {
          this.timers = this.timers.filter((x) => x !== timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }

  async advance(ms: number): Promise<void> {
    const target = this.t + ms;
    for (;;) {
      const due = this.timers.filter((x) => x.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((x) => x !== due);
      this.t = due.at;
      due.resolve();
      await flush();
    }
    this.t = target;
    await flush();
  }
}

/** Reemplazo de Prolog en las pruebas: BFS (el A* real se prueba en ai-prolog/). */
class BfsFinder implements RouteFinder {
  calls = 0;
  async findRoute(board: Board, from: Position): Promise<Route> {
    this.calls++;
    const dirs: Direction[] = ["arriba", "abajo", "izquierda", "derecha"];
    const prev = new Map<string, { from: Position; dir: Direction } | null>([[from.key(), null]]);
    const queue = [from];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.equals(board.exit)) break;
      for (const dir of dirs) {
        const next = cur.step(dir);
        if (!board.inBounds(next) || board.isObstacle(next) || prev.has(next.key())) continue;
        prev.set(next.key(), { from: cur, dir });
        queue.push(next);
      }
    }
    if (!prev.has(board.exit.key())) return { found: false, steps: 0, turns: 0, path: [] };
    const path: { row: number; col: number; direction: Direction }[] = [];
    for (let p = board.exit; prev.get(p.key()); p = prev.get(p.key())!.from) {
      path.unshift({ row: p.row, col: p.col, direction: prev.get(p.key())!.dir });
    }
    let turns = 0;
    for (let i = 1; i < path.length; i++) if (path[i]!.direction !== path[i - 1]!.direction) turns++;
    return { found: true, steps: path.length, turns, path };
  }
}

const P = (r: number, c: number) => new Position(r, c);

interface Setup {
  board: Board;
  humans?: string[];
  cpu?: Difficulty;
  finder?: RouteFinder;
  lives?: number;
  clock?: ManualClock;
  sender?: Recorder;
  matchId?: string;
}

async function setup(opts: Setup) {
  const clock = opts.clock ?? new ManualClock();
  const sender = opts.sender ?? new Recorder();
  const finder = opts.finder ?? new BfsFinder();
  const { board } = opts;
  const lives = opts.lives ?? 3;
  const match = new ChaseMatch({
    board,
    route: await new BfsFinder().findRoute(board, board.start),
    humans: (opts.humans ?? ["ana"]).map((id) => new HumanRacer(id, board.start, lives)),
    cpu: opts.cpu ? new CpuRacer("cpu", board.start, lives, DIFFICULTIES[opts.cpu].cpuIntervalMs) : undefined,
    difficulty: opts.cpu,
    finder,
    sender,
    clock,
    matchId: opts.matchId,
  });
  return { match, clock, sender, finder };
}

/** Empieza la partida y deja pasar la cuenta regresiva (3 s). */
async function go(s: { match: ChaseMatch; clock: ManualClock }): Promise<void> {
  const begun = s.match.begin();
  await s.clock.advance(3000);
  await begun;
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

/** Pasillo de 1 fila: inicio a la izquierda, salida a la derecha (siempre en un borde). */
const corridor = (cols: number, obstacles: Position[] = []) => new Board(1, cols, obstacles, P(0, 0), P(0, cols - 1));

// ---- Mapa --------------------------------------------------------------------

describe("Board", () => {
  it("la salida siempre está en un borde y distinta del inicio", () => {
    for (let i = 0; i < 100; i++) {
      const b = Board.generate(8, 10, 25);
      assert.ok(b.isBorder(b.exit));
      assert.equal(b.start.equals(b.exit), false);
      assert.equal(b.isObstacle(b.start), false);
      assert.equal(b.isObstacle(b.exit), false);
      assert.equal(b.obstacleList().length, Math.floor((8 * 10 * 25) / 100));
    }
  });

  it("respeta la distancia mínima entre inicio y salida", () => {
    for (let i = 0; i < 50; i++) {
      const b = Board.generate(10, 14, 20, Math.random, 12);
      assert.ok(Math.abs(b.start.row - b.exit.row) + Math.abs(b.start.col - b.exit.col) >= 12);
    }
  });

  it("con el mismo generador al azar da el mismo mapa", () => {
    const seq = () => {
      let n = 7;
      return () => ((n = (n * 16807) % 2147483647) / 2147483647);
    };
    const a = Board.generate(6, 6, 20, seq());
    const b = Board.generate(6, 6, 20, seq());
    assert.deepEqual(a.obstacleList(), b.obstacleList());
    assert.ok(a.exit.equals(b.exit) && a.start.equals(b.start));
  });

  it("rechaza salidas fuera del borde, tamaños y porcentajes absurdos", () => {
    assert.throws(() => new Board(5, 5, [], P(0, 0), P(2, 2)), RangeError);
    assert.throws(() => Board.generate(1, 5, 10), RangeError);
    assert.throws(() => Board.generate(5, 5, 90), RangeError);
  });
});

describe("MapBuilder", () => {
  const spec = { rows: 6, cols: 8, obstaclePct: 20, minSteps: 5 };

  it("devuelve un mapa con ruta (la confirma el buscador de rutas)", async () => {
    const { board, route } = await new MapBuilder(new BfsFinder()).build(spec);
    assert.equal(route.found, true);
    assert.ok(route.steps >= spec.minSteps);
    assert.ok(board.isBorder(board.exit));
  });

  it("descarta los mapas sin ruta y vuelve a intentar", async () => {
    let calls = 0;
    const flaky: RouteFinder = {
      async findRoute(board, from) {
        return ++calls <= 3 ? { found: false, steps: 0, turns: 0, path: [] } : new BfsFinder().findRoute(board, from);
      },
    };
    await new MapBuilder(flaky).build({ ...spec, obstaclePct: 0 });
    assert.equal(calls, 4);
  });

  it("falla si ningún intento tiene ruta", async () => {
    const never: RouteFinder = { findRoute: async () => ({ found: false, steps: 0, turns: 0, path: [] }) };
    await assert.rejects(new MapBuilder(never, Math.random, 5).build(spec));
  });
});

describe("HumanRacer", () => {
  it("no está lista hasta pasados 0,5 s desde su último movimiento", () => {
    const h = new HumanRacer("ana", P(0, 0), 3);
    assert.equal(h.isReady(0), true);
    h.markAction(1000);
    assert.equal(h.isReady(1000 + HUMAN_COOLDOWN_MS - 1), false);
    assert.equal(h.isReady(1000 + HUMAN_COOLDOWN_MS), true);
    assert.equal(h.readiness(1250), 0.5);
  });

  it("cuenta pasos y giros; el primer paso no es giro", () => {
    const r = new HumanRacer("ana", P(0, 0), 3);
    assert.equal(r.advance("derecha").turn, false);
    assert.equal(r.advance("abajo").turn, true);
    assert.equal(r.steps, 2);
    assert.equal(r.turns, 1);
  });
});

describe("LevelProgress", () => {
  it("empieza en el nivel elegido y cada nivel sube la velocidad de la IA", () => {
    const speeds = LEVELS.map((d) => DIFFICULTIES[d].cpuIntervalMs);
    assert.deepEqual([...speeds].sort((a, b) => b - a), speeds, "cada nivel mueve más rápido");
    const p = new LevelProgress("normal");
    assert.equal(p.number, 2);
    assert.equal(p.difficulty, "normal");
  });

  it("avanza hasta el último nivel y después vuelve al primero", () => {
    const p = new LevelProgress("facil");
    const seen = [p.difficulty];
    while (!p.isLast) {
      p.advance();
      seen.push(p.difficulty);
    }
    assert.deepEqual(seen, [...LEVELS]);
    p.advance();
    assert.equal(p.number, 1);
  });
});

// ---- Partida: humano contra humano -------------------------------------------

describe("ChaseMatch (humano contra humano)", () => {
  it("nadie se mueve durante la cuenta regresiva", async () => {
    const s = await setup({ board: corridor(6), humans: ["ana", "beto"] });
    const begun = s.match.begin();
    assert.equal(s.match.phase, "countdown");
    assert.equal(s.match.moveHuman("ana", "derecha"), "ignored");
    await s.clock.advance(3000);
    await begun;
    assert.equal(s.match.phase, "playing");
    assert.equal(s.match.moveHuman("ana", "derecha"), "moved");
  });

  it("una persona no puede moverse más de una vez cada 0,5 s", async () => {
    const s = await setup({ board: corridor(8) });
    await go(s);
    assert.equal(s.match.moveHuman("ana", "derecha"), "moved");
    assert.equal(s.match.moveHuman("ana", "derecha"), "cooldown");
    await s.clock.advance(499);
    assert.equal(s.match.moveHuman("ana", "derecha"), "cooldown");
    await s.clock.advance(1);
    assert.equal(s.match.moveHuman("ana", "derecha"), "moved");
    assert.equal(s.match.humans[0]!.steps, 2);
  });

  it("el cooldown de cada persona es independiente", async () => {
    const s = await setup({ board: corridor(8), humans: ["ana", "beto"] });
    await go(s);
    assert.equal(s.match.moveHuman("ana", "derecha"), "moved");
    assert.equal(s.match.moveHuman("beto", "derecha"), "moved");
    assert.equal(s.match.moveHuman("ana", "derecha"), "cooldown");
  });

  it("gana quien llega primero a la salida; los eventos cumplen el contrato", async () => {
    const s = await setup({ board: corridor(4), humans: ["ana", "beto"] });
    await go(s);
    for (let i = 0; i < 3; i++) {
      s.match.moveHuman("ana", "derecha");
      if (i < 2) s.match.moveHuman("beto", "derecha");
      await s.clock.advance(HUMAN_COOLDOWN_MS);
    }
    assert.deepEqual(s.match.outcome, { kind: "won", winnerId: "ana" });
    assert.deepEqual(s.sender.events.at(-1)!.data, { winnerId: "ana" });
    assert.equal(s.sender.events.filter((e) => e.type === "TARGET_REACHED").length, 1);
    assertValidContract(s.sender.events);
  });

  it("MATCH_STARTED, PLAYER_JOINED y ROUTE_COMPUTED traen lo que pide el contrato", async () => {
    const s = await setup({ board: corridor(5), humans: ["ana", "beto"] });
    await go(s);
    const [started] = s.sender.events;
    assert.deepEqual(started!.data, {
      rows: 1, cols: 5, obstaclePct: 0, lives: 3, mode: "vs-human", exit: { row: 0, col: 4 }, humanCooldownMs: 500,
    });
    assert.deepEqual(s.sender.types(), [
      "MATCH_STARTED", "PLAYER_JOINED", "PLAYER_JOINED", "ROUTE_COMPUTED", "ROUTE_COMPUTED",
    ]);
    const route = s.sender.events.find((e) => e.type === "ROUTE_COMPUTED" && e.playerId === "beto")!;
    assert.deepEqual(route.data, {
      found: true, start: { row: 0, col: 0 }, goal: { row: 0, col: 4 }, optimalSteps: 4, routeTurns: 0,
    });
  });

  it("chocar cuesta una vida y la espera; contra el borde no pasa nada", async () => {
    const s = await setup({ board: new Board(2, 3, [P(0, 1)], P(0, 0), P(1, 2)) });
    await go(s);
    assert.equal(s.match.moveHuman("ana", "arriba"), "edge");
    assert.equal(s.match.moveHuman("ana", "derecha"), "hit");
    assert.equal(s.match.humans[0]!.lives, 2);
    assert.equal(s.match.humans[0]!.steps, 0, "los choques no cuentan como pasos");
    assert.equal(s.match.moveHuman("ana", "abajo"), "cooldown", "el choque también espera 0,5 s");
    const hit = s.sender.events.find((e) => e.type === "OBSTACLE_HIT")!;
    assert.deepEqual(hit.data, { row: 0, col: 1, livesLeft: 2 });
  });

  it("sin vidas una persona queda eliminada; si todas lo están, termina sin ganador", async () => {
    const s = await setup({ board: new Board(2, 3, [P(0, 1)], P(0, 0), P(1, 2)), humans: ["ana", "beto"], lives: 1 });
    await go(s);
    assert.equal(s.match.moveHuman("ana", "derecha"), "eliminated");
    assert.equal(s.match.phase, "playing", "beto sigue");
    await s.clock.advance(HUMAN_COOLDOWN_MS);
    assert.equal(s.match.moveHuman("ana", "abajo"), "ignored", "eliminada: ya no se mueve");
    assert.equal(s.match.moveHuman("beto", "derecha"), "eliminated");
    assert.deepEqual(s.match.outcome, { kind: "all-eliminated" });
    assert.equal(s.sender.events.at(-1)!.data, undefined, "sin winnerId");
    assertValidContract(s.sender.events);
  });

  it("abandonar durante la cuenta regresiva cierra la partida una sola vez", async () => {
    const s = await setup({ board: corridor(5) });
    const begun = s.match.begin();
    s.match.abandon();
    s.match.abandon();
    await begun; // no lanza
    await s.clock.advance(5000);
    assert.equal(s.sender.types().filter((t) => t === "MATCH_FINISHED").length, 1);
    assert.equal(s.sender.types().at(-1), "MATCH_FINISHED");
    assertValidContract(s.sender.events);
  });

  it("una partida que nunca empezó no manda eventos al cerrarse", async () => {
    const s = await setup({ board: corridor(5) });
    s.match.abandon();
    assert.deepEqual(s.sender.events, []);
  });
});

// ---- Partida: humano contra la IA ---------------------------------------------

describe("ChaseMatch (humano contra IA)", () => {
  it("la IA mueve sola, una vez por intervalo de su dificultad", async () => {
    const s = await setup({ board: corridor(60), cpu: "experto" });
    await go(s);
    await s.clock.advance(3500);
    assert.equal(s.match.cpu!.steps, 10); // 3500 / 350
  });

  it("a más dificultad, la IA avanza más rápido en el mismo tiempo", async () => {
    const steps: number[] = [];
    for (const difficulty of ["facil", "normal", "dificil", "experto"] as const) {
      const s = await setup({ board: corridor(80), cpu: difficulty });
      await go(s);
      await s.clock.advance(7000);
      steps.push(s.match.cpu!.steps);
    }
    assert.deepEqual(steps, [7, 10, 14, 20]);
    assert.deepEqual([...steps].sort((a, b) => a - b), steps);
  });

  it("en cada paso la IA le pregunta la ruta al buscador (Prolog), no elige al azar", async () => {
    const finder = new BfsFinder();
    const s = await setup({ board: corridor(30), cpu: "dificil", finder });
    await go(s);
    const before = finder.calls;
    await s.clock.advance(2000); // 4 pasos
    assert.equal(s.match.cpu!.steps, 4);
    assert.ok(finder.calls - before >= 4);
    assert.ok(s.match.cpu!.position.equals(P(0, 4)), "siguió la ruta que le dio el buscador");
  });

  it("si la IA llega primero, gana; si la persona llega primero, gana la persona", async () => {
    const lose = await setup({ board: corridor(5), cpu: "experto" });
    await go(lose);
    await lose.clock.advance(4 * 350);
    assert.deepEqual(lose.match.outcome, { kind: "won", winnerId: "cpu" });
    assertValidContract(lose.sender.events);

    const win = await setup({ board: corridor(5), cpu: "facil" });
    await go(win);
    for (let i = 0; i < 4; i++) {
      win.match.moveHuman("ana", "derecha");
      await win.clock.advance(HUMAN_COOLDOWN_MS);
    }
    assert.deepEqual(win.match.outcome, { kind: "won", winnerId: "ana" });
    assertValidContract(win.sender.events);
  });

  it("MATCH_STARTED guarda el modo y la dificultad", async () => {
    const s = await setup({ board: corridor(5), cpu: "dificil" });
    await go(s);
    assert.deepEqual(s.sender.events[0]!.data, {
      rows: 1, cols: 5, obstaclePct: 0, lives: 3, mode: "vs-cpu", exit: { row: 0, col: 4 },
      humanCooldownMs: 500, difficulty: "dificil", cpuIntervalMs: 500,
    });
  });

  it("después de MATCH_FINISHED no sale ningún evento más, aunque la IA siga esperando", async () => {
    const s = await setup({ board: corridor(4), cpu: "experto" });
    await go(s);
    await s.clock.advance(3 * 350);
    const count = s.sender.events.length;
    await s.clock.advance(10_000);
    assert.equal(s.sender.events.length, count);
    assert.equal(s.sender.types().at(-1), "MATCH_FINISHED");
  });

  it("abandonar mientras la IA espera a Prolog cancela la espera sin error", async () => {
    const hanging: RouteFinder = {
      findRoute: (_b, _f, signal) =>
        new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(signal.reason))),
    };
    const s = await setup({ board: corridor(8), cpu: "normal", finder: hanging });
    await go(s);
    s.match.abandon();
    await s.clock.advance(5000);
    assert.equal(s.match.outcome?.kind, "abandoned");
    assert.equal(s.match.error, null);
    assert.equal(s.sender.types().at(-1), "MATCH_FINISHED");
  });

  it("si Prolog devuelve una jugada inválida, la partida se cierra y guarda el error", async () => {
    const wrong: RouteFinder = {
      findRoute: async () => ({ found: true, steps: 1, turns: 0, path: [{ row: 0, col: 0, direction: "arriba" }] }),
    };
    const s = await setup({ board: corridor(8), cpu: "normal", finder: wrong });
    await go(s);
    await s.clock.advance(700);
    assert.equal(s.match.phase, "finished");
    assert.match(s.match.error?.message ?? "", /inválida/);
    assertValidContract(s.sender.events);
  });

  it("la persona eliminada queda fuera pero la IA sigue y gana", async () => {
    const board = new Board(2, 6, [P(1, 1)], P(0, 0), P(0, 5));
    const s = await setup({ board, cpu: "dificil", lives: 1 });
    await go(s);
    assert.equal(s.match.moveHuman("ana", "abajo"), "moved"); // (1,0)
    await s.clock.advance(HUMAN_COOLDOWN_MS);
    assert.equal(s.match.moveHuman("ana", "derecha"), "eliminated"); // choca con (1,1)
    await s.clock.advance(5000);
    assert.deepEqual(s.match.outcome, { kind: "won", winnerId: "cpu" });
  });
});

// ---- Varias partidas a la vez --------------------------------------------------

describe("partidas simultáneas", () => {
  it("dos partidas con el mismo emisor y reloj no mezclan sus eventos", async () => {
    const clock = new ManualClock();
    const sender = new Recorder();
    const a = await setup({ board: corridor(5), cpu: "experto", clock, sender, matchId: "chase-A" });
    const b = await setup({ board: corridor(7), cpu: "dificil", clock, sender, matchId: "chase-B" });
    const begun = [a.match.begin(), b.match.begin()];
    await clock.advance(3000);
    await Promise.all(begun);
    await clock.advance(6 * 500);

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
  const board = new Board(3, 3, [P(1, 1)], P(0, 0), P(2, 2));
  const okBody = { found: true, steps: 1, turns: 0, path: [{ row: 0, col: 1, direction: "derecha" }] };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("manda el mapa completo en el formato del contrato", async () => {
    let sent: any;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return json(okBody);
    }) as unknown as typeof fetch;
    const route = await new PrologRouteFinder({ baseUrl: "/api/prolog", fetchFn }).findRoute(board, P(0, 0));
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
      baseUrl: "/api/prolog", fetchFn, sleep: async () => {},
      onUnavailable: (n) => unavailable.push(n), onRecovered: () => recovered++,
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
    const finder = new PrologRouteFinder({ baseUrl: "", fetchFn, sleep: async () => controller.abort() });
    await assert.rejects(finder.findRoute(board, P(0, 0), controller.signal));
  });

  it("found=false se devuelve como ruta vacía", async () => {
    const fetchFn = (async () => json({ found: false })) as unknown as typeof fetch;
    const route = await new PrologRouteFinder({ baseUrl: "", fetchFn }).findRoute(board, P(0, 0));
    assert.deepEqual(route, { found: false, steps: 0, turns: 0, path: [] });
  });
});
