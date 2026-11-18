import { Position } from "./Position.ts";

/**
 * El mapa de chase: tamaño, obstáculos, la celda de salida (siempre en un borde)
 * y la celda donde empiezan todos los jugadores. Todos juegan en el MISMO mapa.
 * Encapsula los obstáculos: desde fuera solo se pregunta, no se modifican.
 */
export class Board {
  readonly rows: number;
  readonly cols: number;
  readonly start: Position;
  readonly exit: Position;
  /** Porcentaje con el que se generó (lo pide MATCH_STARTED). */
  readonly obstaclePct: number;
  private readonly obstacles: ReadonlyMap<string, Position>;

  constructor(
    rows: number,
    cols: number,
    obstacles: readonly Position[],
    start: Position,
    exit: Position,
    obstaclePct = 0,
  ) {
    this.rows = rows;
    this.cols = cols;
    this.start = start;
    this.exit = exit;
    this.obstaclePct = obstaclePct;
    this.obstacles = new Map(obstacles.map((p) => [p.key(), p]));
    if (!this.isBorder(exit)) throw new RangeError("La salida debe estar en un borde del mapa");
  }

  inBounds(p: Position): boolean {
    return p.row >= 0 && p.row < this.rows && p.col >= 0 && p.col < this.cols;
  }

  isBorder(p: Position): boolean {
    return this.inBounds(p) && (p.row === 0 || p.col === 0 || p.row === this.rows - 1 || p.col === this.cols - 1);
  }

  isObstacle(p: Position): boolean {
    return this.obstacles.has(p.key());
  }

  obstacleList(): Position[] {
    return [...this.obstacles.values()];
  }

  /**
   * Mapa al azar. La salida cae en una celda del borde; el inicio, en una celda a
   * distancia Manhattan >= `minDistance` de la salida (si no hay ninguna, en la más
   * lejana). Los obstáculos van en otras celdas. No garantiza que exista ruta: eso lo
   * comprueba Prolog (ver MapBuilder). `random` devuelve [0, 1); se inyecta para probar.
   */
  static generate(
    rows: number,
    cols: number,
    obstaclePct: number,
    random: () => number = Math.random,
    minDistance = 0,
  ): Board {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
      throw new RangeError("El mapa necesita al menos 2 filas y 2 columnas");
    }
    if (!(obstaclePct >= 0 && obstaclePct <= 60)) {
      throw new RangeError("El porcentaje de obstáculos debe estar entre 0 y 60");
    }
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!;
    const all: Position[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) all.push(new Position(r, c));

    const exit = pick(all.filter((p) => p.row === 0 || p.col === 0 || p.row === rows - 1 || p.col === cols - 1));
    const rest = all.filter((p) => !p.equals(exit));
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    const distance = (p: Position) => Math.abs(p.row - exit.row) + Math.abs(p.col - exit.col);
    const far = rest.filter((p) => distance(p) >= minDistance);
    const start = far.length > 0 ? far[0]! : rest.reduce((best, p) => (distance(p) > distance(best) ? p : best));

    const free = rest.filter((p) => !p.equals(start));
    const count = Math.min(Math.floor((rows * cols * obstaclePct) / 100), free.length);
    return new Board(rows, cols, free.slice(0, count), start, exit, obstaclePct);
  }
}
