import { deltaOf, type Direction } from "./Direction.ts";

/** Celda del tablero. Inmutable: mover produce otra posición. Coordenadas desde 0. */
export class Position {
  readonly row: number;
  readonly col: number;

  constructor(row: number, col: number) {
    this.row = row;
    this.col = col;
  }

  step(direction: Direction): Position {
    const [dr, dc] = deltaOf(direction);
    return new Position(this.row + dr, this.col + dc);
  }

  equals(other: Position): boolean {
    return this.row === other.row && this.col === other.col;
  }

  /** Clave para conjuntos y mapas. */
  key(): string {
    return `${this.row},${this.col}`;
  }

  /** Forma {row, col} del contrato de GameStats y del servicio Prolog. */
  toJSON(): { row: number; col: number } {
    return { row: this.row, col: this.col };
  }
}
