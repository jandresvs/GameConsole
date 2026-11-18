export type Direction = "arriba" | "abajo" | "izquierda" | "derecha";

export const DIRECTIONS: readonly Direction[] = ["arriba", "abajo", "izquierda", "derecha"];

const DELTAS: Record<Direction, readonly [number, number]> = {
  arriba: [-1, 0],
  abajo: [1, 0],
  izquierda: [0, -1],
  derecha: [0, 1],
};

export function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && (DIRECTIONS as readonly string[]).includes(value);
}

/** Cambio de [fila, columna] que produce un paso en esa dirección. */
export function deltaOf(direction: Direction): readonly [number, number] {
  return DELTAS[direction];
}
