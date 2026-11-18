import { Position } from "./Position.ts";

/** Tablero ya generado: dónde empieza cada jugador. */
export interface Layout {
  readonly board: Board;
  readonly userStart: Position;
  readonly cpuStart: Position;
}

/**
 * El tablero de chase: tamaño, obstáculos y La Mala (la meta, que no se mueve).
 * Encapsula los obstáculos: desde fuera solo se pregunta, no se modifican.
 */
export class Board {
  readonly rows: number;
  readonly cols: number;
  readonly target: Position;
  /** Porcentaje con el que se generó (lo pide MATCH_STARTED). */
  readonly obstaclePct: number;
  private readonly obstacles: ReadonlyMap<string, Position>;

  constructor(rows: number, cols: number, obstacles: readonly Position[], target: Position, obstaclePct = 0) {
    this.rows = rows;
    this.cols = cols;
    this.target = target;
    this.obstaclePct = obstaclePct;
    this.obstacles = new Map(obstacles.map((p) => [p.key(), p]));
  }

  inBounds(p: Position): boolean {
    return p.row >= 0 && p.row < this.rows && p.col >= 0 && p.col < this.cols;
  }

  isObstacle(p: Position): boolean {
    return this.obstacles.has(p.key());
  }

  obstacleList(): Position[] {
    return [...this.obstacles.values()];
  }

  /**
   * Tablero al azar: La Mala y las dos Buenas en celdas distintas y los obstáculos
   * en otras. `random` devuelve un número en [0, 1); se inyecta para poder probar.
   */
  static generate(rows: number, cols: number, obstaclePct: number, random: () => number = Math.random): Layout {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
      throw new RangeError("El tablero necesita al menos 2 filas y 2 columnas");
    }
    if (!(obstaclePct >= 0 && obstaclePct <= 60)) {
      throw new RangeError("El porcentaje de obstáculos debe estar entre 0 y 60");
    }
    const cells: Position[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(new Position(r, c));
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cells[i], cells[j]] = [cells[j]!, cells[i]!];
    }
    const [target, userStart, cpuStart] = [cells[0]!, cells[1]!, cells[2]!];
    const count = Math.min(Math.floor((rows * cols * obstaclePct) / 100), cells.length - 3);
    const board = new Board(rows, cols, cells.slice(3, 3 + count), target, obstaclePct);
    return { board, userStart, cpuStart };
  }
}
