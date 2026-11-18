import type { Controls } from "../Car";
import type { PlayerCar } from "../PlayerCar";
import type { Track } from "../Track";

/**
 * Solo para pruebas: maneja el auto del jugador con las mismas Controls que
 * daría el teclado. Apunta a un punto un poco más adelante en la pista y
 * frena antes de las curvas según su agarre.
 */
export class Autopilot {
  constructor(
    private readonly track: Track,
    private readonly car: PlayerCar,
    private readonly grip = 330,
  ) {}

  controls(): Controls {
    const s = this.car.trackPosition;
    const target = this.track.pose(s + 55);
    let diff = Math.atan2(target.y - this.car.y, target.x - this.car.x) - this.car.heading;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    let maxCurvature = 0;
    for (let d = 0; d <= 140; d += 10) maxCurvature = Math.max(maxCurvature, this.track.curvature(s + d));
    const safe = maxCurvature > 1e-6 ? Math.sqrt(this.grip / maxCurvature) : Infinity;

    return {
      throttle: this.car.speed < safe - 5,
      brake: this.car.speed > safe + 20,
      left: diff < -0.03,
      right: diff > 0.03,
    };
  }
}
