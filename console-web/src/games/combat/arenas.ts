import { Arena } from "./Arena";

/**
 * La Plaza: arena simétrica de 760 × 420 (debajo de la franja del marcador).
 * Un bloque al centro, dos barras arriba y abajo, y cuatro pilares a los
 * lados para cubrirse. Seis puntos de aparición en los bordes.
 */
export function laPlaza(): Arena {
  return new Arena(
    "La Plaza",
    { x: 0, y: 40, w: 760, h: 420 },
    [
      { x: 345, y: 215, w: 70, h: 70 }, // bloque central
      { x: 300, y: 108, w: 160, h: 24 }, // barra superior
      { x: 300, y: 368, w: 160, h: 24 }, // barra inferior
      { x: 168, y: 112, w: 28, h: 84 }, // pilares izquierdos
      { x: 168, y: 304, w: 28, h: 84 },
      { x: 564, y: 112, w: 28, h: 84 }, // pilares derechos
      { x: 564, y: 304, w: 28, h: 84 },
    ],
    [
      { x: 56, y: 84 },
      { x: 704, y: 416 },
      { x: 704, y: 84 },
      { x: 56, y: 416 },
      { x: 56, y: 250 },
      { x: 704, y: 250 },
    ],
  );
}
