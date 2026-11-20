/** Las características de un arma. Velocidades en px/s, distancias en px, ángulos en radianes. */
export interface WeaponSpec {
  /** Nombre que va en los eventos (`weapon`). */
  readonly id: "rifle" | "pistola" | "escopeta";
  readonly label: string;
  readonly damage: number;
  /** Tiempo mínimo entre disparos. */
  readonly cooldownMs: number;
  readonly projectileSpeed: number;
  /** Distancia que recorre el proyectil antes de perderse. */
  readonly range: number;
  /** Imprecisión propia del arma: el disparo sale con hasta ± spread/2 de desvío. */
  readonly spread: number;
  /** Distancia a la que un bot prefiere pelear con esta arma. */
  readonly preferredDistance: number;
}

export const WEAPONS: readonly WeaponSpec[] = [
  { id: "rifle", label: "Rifle", damage: 34, cooldownMs: 420, projectileSpeed: 680, range: 560, spread: 0.03, preferredDistance: 260 },
  { id: "pistola", label: "Pistola", damage: 25, cooldownMs: 260, projectileSpeed: 560, range: 420, spread: 0.07, preferredDistance: 190 },
  { id: "escopeta", label: "Escopeta", damage: 50, cooldownMs: 900, projectileSpeed: 520, range: 210, spread: 0.02, preferredDistance: 110 },
];

/** Un arma en manos de un luchador: las características más su enfriamiento. */
export class Weapon {
  private readyAtMs = 0;

  constructor(readonly spec: WeaponSpec) {}

  canFire(nowMs: number): boolean {
    return nowMs >= this.readyAtMs;
  }

  /** Registra un disparo; el arma queda enfriándose. */
  fire(nowMs: number): void {
    this.readyAtMs = nowMs + this.spec.cooldownMs;
  }
}
