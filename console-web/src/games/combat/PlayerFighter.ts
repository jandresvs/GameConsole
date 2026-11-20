import { Fighter, type Intent } from "./Fighter";
import { angleTo, type Vec } from "./geometry";

/** Lo que el usuario está haciendo con el teclado y el ratón. */
export interface PlayerInput {
  readonly up: boolean;
  readonly down: boolean;
  readonly left: boolean;
  readonly right: boolean;
  /** Dónde está el puntero, en coordenadas de la arena. */
  readonly aimAt?: Vec;
  readonly shoot: boolean;
  /** Arma elegida con 1, 2 o 3 (índice 0, 1 o 2). */
  readonly weapon?: number;
}

export const NO_INPUT: PlayerInput = { up: false, down: false, left: false, right: false, shoot: false };

/** El luchador del usuario: traduce el teclado y el ratón en intenciones. */
export class PlayerFighter extends Fighter {
  private input: PlayerInput = NO_INPUT;

  constructor(playerId: string, color: string, spawn: Vec) {
    super(playerId, color, spawn, 0, 175);
  }

  /** La consola le pasa aquí lo que el usuario hace en este cuadro. */
  setInput(input: PlayerInput): void {
    this.input = input;
  }

  think(): Intent {
    const i = this.input;
    return {
      moveX: Number(i.right) - Number(i.left),
      moveY: Number(i.down) - Number(i.up),
      aim: i.aimAt ? angleTo(this.pos, i.aimAt) : this.aimAngle,
      shoot: i.shoot,
      ...(i.weapon !== undefined && { weapon: i.weapon }),
    };
  }
}
