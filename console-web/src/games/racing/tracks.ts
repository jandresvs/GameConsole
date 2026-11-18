import { Track } from "./Track";

/**
 * Circuito Arenal: una recta de meta abajo, una curva amplia a la derecha,
 * una S por el centro y una horquilla cerrada arriba a la izquierda.
 * Pensado para un lienzo de 760 × 460.
 */
export function circuitoArenal(laps = 3): Track {
  return new Track("Circuito Arenal", laps, 58, [
    { x: 300, y: 398 }, // línea de meta (s = 0), en medio de la recta
    { x: 480, y: 400 },
    { x: 615, y: 388 },
    { x: 692, y: 318 },
    { x: 690, y: 200 },
    { x: 632, y: 110 },
    { x: 522, y: 78 },
    { x: 432, y: 138 },
    { x: 342, y: 206 },
    { x: 244, y: 138 },
    { x: 150, y: 76 },
    { x: 72, y: 150 },
    { x: 70, y: 300 },
    { x: 142, y: 386 },
  ]);
}
