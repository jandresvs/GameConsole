import { Game, type GameContext } from "../core/Game";
import type { GameDefinition } from "../core/GameDefinition";
import { Random } from "../core/Random";
import { BOTS } from "./bots";
import type { Controls } from "./Car";
import { Race, type RaceListener } from "./Race";
import { RaceRenderer } from "./RaceRenderer";
import { circuitoArenal } from "./tracks";

const WIDTH = 760;
const HEIGHT = 460;
const PLAYER_COLOR = "#f2b441";

/**
 * Racing: el usuario contra tres pilotos automáticos, a tres vueltas.
 *
 * Esta clase solo conecta piezas: lee el teclado, se lo pasa a Race (las
 * reglas), le pide a RaceRenderer que dibuje, y convierte lo que avisa la
 * carrera en los eventos del contrato de GameStats:
 *
 *   MATCH_STARTED  {track, laps}          (lo emite la base con matchStartData)
 *   CRASH          {lap, timeLostMs}      por piloto
 *   LAP_COMPLETED  {lap, lapTimeMs}       por piloto; el tiempo ya incluye los choques
 *   MATCH_FINISHED {winnerId}             el primero en completar las vueltas
 */
export class RacingGame extends Game {
  static readonly definition: GameDefinition = {
    id: "racing",
    title: "Racing",
    description: "Carrera de 3 vueltas contra tres pilotos automáticos. Chocar con el muro te cuesta tiempo.",
    controls: "↑ o W acelera · ↓ o S frena y retrocede · ← → o A D giran. Haz clic en la pista si no responde.",
    create: (context) => new RacingGame(context),
  };

  private readonly race: Race;
  private readonly renderer: RaceRenderer;

  constructor(context: GameContext, random: Random = new Random()) {
    super("racing", context, { width: WIDTH, height: HEIGHT });
    const track = circuitoArenal();
    this.race = new Race(track, this.playerId, PLAYER_COLOR, BOTS, this.raceListener(), random);
    this.renderer = new RaceRenderer(track, WIDTH, HEIGHT);
  }

  protected players(): readonly string[] {
    return this.race.cars.map((c) => c.playerId);
  }

  protected override matchStartData() {
    return { track: this.race.track.name, laps: this.race.track.laps };
  }

  protected onStart(): void {
    // La carrera ya quedó armada en el constructor; empieza con la cuenta regresiva.
  }

  protected update(dtMs: number): void {
    this.race.update(dtMs, this.readControls());
  }

  protected render(ctx: CanvasRenderingContext2D): void {
    this.renderer.draw(ctx, this.race);
  }

  private readControls(): Controls {
    const k = this.keyboard;
    return {
      throttle: k.isDown("ArrowUp") || k.isDown("KeyW"),
      brake: k.isDown("ArrowDown") || k.isDown("KeyS"),
      left: k.isDown("ArrowLeft") || k.isDown("KeyA"),
      right: k.isDown("ArrowRight") || k.isDown("KeyD"),
    };
  }

  private raceListener(): RaceListener {
    return {
      onCrash: (playerId, lap, timeLostMs) => this.emit("CRASH", { lap, timeLostMs }, playerId),
      onLapCompleted: (playerId, lap, lapTimeMs) => this.emit("LAP_COMPLETED", { lap, lapTimeMs }, playerId),
      onFinished: (winnerId) => this.finish(winnerId),
    };
  }
}
