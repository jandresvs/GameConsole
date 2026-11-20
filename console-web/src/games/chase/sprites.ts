/**
 * Sprites de chase en pixel art. Cada uno es una cuadrícula de caracteres (una
 * letra por píxel, "." es transparente) más una paleta que dice qué color es
 * cada letra. Así el arte vive en el código: no hay archivos de imagen que
 * cargar ni licencias que revisar, y cambiar un color es cambiar la paleta
 * (la CPU es el mismo caballero con otra túnica).
 *
 * Este módulo es solo datos: no toca el DOM. SpriteAtlas (en
 * ChaseRenderer.ts) los convierte en imágenes la primera vez que se dibujan.
 */

export type Palette = Readonly<Record<string, string>>;

export interface PixelArt {
  readonly rows: readonly string[];
  readonly palette: Palette;
}

export const SPRITE_SIZE = 16;

const OUTLINE = "#1b1d24";
const SHADOW = "rgba(0, 0, 0, 0.28)";

// ---------------------------------------------------------------- personajes

const KNIGHT_ROWS = [
  "................",
  "......kkkk......",
  ".....kHHHHk.....",
  "....kHWHHHhk....",
  "....kHkkkkhk..k.",
  "....kHHHHHhk.kWk",
  ".....khhhhk..kWk",
  "...kkCCCCCCkkkWk",
  "..kHkCCeeCCkHkWk",
  "..kHkCCeeCckHkWk",
  "..kskBBBBBBkskYk",
  "...kkCCCCCckkkYk",
  "....kccCccck..k.",
  "....kLLkkLLk....",
  "....kkk..kkk....",
  "...ssssssssss...",
];

const KNIGHT_BASE: Palette = {
  k: OUTLINE,
  H: "#c9ced6", // casco
  h: "#8d949e",
  W: "#eef1f5", // brillo y hoja de la espada
  e: "#f6efd8", // emblema
  B: "#6b4423", // cinturón
  Y: "#d9a62e", // empuñadura
  s: SHADOW,
  L: "#4e3b2a", // botas
};

/** La Buena del usuario: túnica dorada. */
export const KNIGHT_USER: PixelArt = {
  rows: KNIGHT_ROWS,
  palette: { ...KNIGHT_BASE, C: "#e8b33a", c: "#b8862a" },
};

/** La Buena de la CPU: el mismo caballero con túnica azul. */
export const KNIGHT_CPU: PixelArt = {
  rows: KNIGHT_ROWS,
  palette: { ...KNIGHT_BASE, C: "#4a8fd9", c: "#2f64a8" },
};

/** La segunda persona (humano contra humano): el mismo caballero con túnica morada. */
export const KNIGHT_PLAYER2: PixelArt = {
  rows: KNIGHT_ROWS,
  palette: { ...KNIGHT_BASE, C: "#9b6fd6", c: "#6d46a3" },
};

// ---------------------------------------------------------------- la salida

/** La salida del mapa: un portal de piedra con luz verde. Siempre está en un borde. */
export const EXIT_GATE: PixelArt = {
  rows: [
    "................",
    "....kkkkkkkk....",
    "...kLLLLLLLLk...",
    "..kLLkkkkkkLLk..",
    "..kLkGGGGGGkLk..",
    "..kLkGggggGkLk..",
    "..kLkGgWWgGkLk..",
    "..kLkGgWWgGkLk..",
    "..kLkGggggGkLk..",
    "..kLkGGGGGGkLk..",
    "..kLkGGGGGGkLk..",
    "..kLkGGGGGGkLk..",
    "..kMkGGGGGGkMk..",
    ".kMMkkkkkkkkMMk.",
    "..ssssssssssss..",
    "................",
  ],
  palette: {
    k: OUTLINE,
    L: "#9aa0a8", // piedra
    M: "#6c727c",
    G: "#2e9d62", // luz verde
    g: "#6fe0a0",
    W: "#e8fff2",
    s: SHADOW,
  },
};

// ---------------------------------------------------------------- obstáculos

export const TREE: PixelArt = {
  rows: [
    "................",
    ".....kkkkkk.....",
    "...kkGGgGGGkk...",
    "..kGGggGGGGGGk..",
    ".kGGggGGGGGdGGk.",
    ".kGgGGGGGgGGGGk.",
    ".kGGGGGGGGGGdGk.",
    ".kGGGgGGGGGdGGk.",
    ".kGGGGGGGdGGGdk.",
    "..kGGGGdGGGddk..",
    "...kkdGGGdddk...",
    ".....kkTTkk.....",
    "......kTtk......",
    "......kTtk......",
    ".....kTTTtk.....",
    "...sssssssssss..",
  ],
  palette: {
    k: OUTLINE,
    G: "#2f7a33",
    g: "#58a84a",
    d: "#1f5524",
    T: "#7a4f2a",
    t: "#4e2f17",
    s: SHADOW,
  },
};

export const ROCK: PixelArt = {
  rows: [
    "................",
    "................",
    "................",
    "......kkkk......",
    "....kkLLLLkk....",
    "...kLLLLLLLLk...",
    "..kLLWLLLLLLLk..",
    "..kLWWLLLLLLLk..",
    ".kLLLLLLLLLMMLk.",
    ".kLLLLLLLMMMMLk.",
    ".kMLLLLLMMMMMMk.",
    ".kMMMLLMMMMMMMk.",
    "..kMMMMMMMMMMk..",
    "...kkkkkkkkkk...",
    "..ssssssssssss..",
    "................",
  ],
  palette: { k: OUTLINE, L: "#9aa0a8", W: "#d0d4da", M: "#6c727c", s: SHADOW },
};

export const BUSH: PixelArt = {
  rows: [
    "................",
    "................",
    "................",
    "................",
    "......kkkk......",
    "....kkBBBBkk....",
    "...kBBbBBBBBk...",
    "..kBBBBBBrBBBk..",
    ".kBrBBBBBBBBBBk.",
    ".kBBBBBbBBBBrBk.",
    ".kBBBBBBBBBBBBk.",
    ".kbBBrBBBBbBBbk.",
    "..kbbBBBBBBbbk..",
    "...kkkkkkkkkk...",
    "..ssssssssssss..",
    "................",
  ],
  palette: { k: OUTLINE, B: "#3f9a3e", b: "#286b29", r: "#e04848", s: SHADOW },
};

export const OBSTACLES: readonly PixelArt[] = [TREE, TREE, ROCK, BUSH];

// ---------------------------------------------------------------- césped

const GRASS_PALETTE: Palette = {
  ".": "#5b9e45",
  d: "#4d8a3a",
  l: "#6db352",
  y: "#f2d54a",
  w: "#f4f1e6",
};

/**
 * Ocho variantes de césped generadas con una semilla fija: mechones oscuros
 * y claros, y en dos de ellas una flor. Siempre salen iguales.
 */
export const GRASS: readonly PixelArt[] = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => grassTile(seed));

function grassTile(seed: number): PixelArt {
  const next = lcg(seed * 7919);
  const grid = Array.from({ length: SPRITE_SIZE }, () => Array<string>(SPRITE_SIZE).fill("."));
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(next() * (SPRITE_SIZE - 1)) + 1;
    const c = Math.floor(next() * SPRITE_SIZE);
    grid[r]![c] = "d"; // mechón: oscuro abajo, claro arriba
    grid[r - 1]![c] = "l";
  }
  if (seed % 4 === 0) {
    const r = 3 + Math.floor(next() * 10);
    const c = 3 + Math.floor(next() * 10);
    const petal = seed === 4 ? "w" : "y";
    grid[r - 1]![c] = petal;
    grid[r + 1]![c] = petal;
    grid[r]![c - 1] = petal;
    grid[r]![c + 1] = petal;
    grid[r]![c] = "y";
  }
  return { rows: grid.map((row) => row.join("")), palette: GRASS_PALETTE };
}

// ---------------------------------------------------------------- HUD

export const HEART_FULL: PixelArt = {
  rows: [
    ".kk.kk..",
    "kRWkRRk.",
    "kRRRRRk.",
    "kRRRRRk.",
    ".kRRRk..",
    "..kRk...",
    "...k....",
    "........",
  ],
  palette: { k: OUTLINE, R: "#e8454a", W: "#ffd0d0" },
};

export const HEART_EMPTY: PixelArt = {
  rows: [
    ".kk.kk..",
    "kEEkEEk.",
    "kEEEEEk.",
    "kEEEEEk.",
    ".kEEEk..",
    "..kEk...",
    "...k....",
    "........",
  ],
  palette: { k: OUTLINE, E: "#3a3f4d" },
};

/** Número pseudoaleatorio en [0, 1) con semilla, para que el arte sea fijo. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Elige siempre lo mismo para la misma celda (que un árbol no cambie a roca entre cuadros). */
export function pickFor<T>(options: readonly T[], row: number, col: number, salt = 0): T {
  const h = Math.imul(row * 73856093 ^ col * 19349663 ^ salt * 83492791, 2654435761) >>> 0;
  return options[h % options.length]!;
}
