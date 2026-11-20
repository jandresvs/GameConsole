import { describe, expect, it } from "vitest";
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
class BfsFinder implements RouteFinder {
  calls = 0;
  async findRoute(board: Board, from: Position): Promise<Route> {
    this.calls++;
    const prev = new Map<string, { from: Position; dir: Direction } | null>([[from.key(), null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.equals(board.exit)) break;
      for (const dir of DIRECTIONS) {
        const [dr, dc] = deltaOf(dir);
        const next = new Position(cur.row + dr, cur.col + dc);
        if (!board.inBounds(next) || board.isObstacle(next) || prev.has(next.key())) continue;
        prev.set(next.key(), { from: cur, dir });
        queue.push(next);
      }
    }
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
  });
});
