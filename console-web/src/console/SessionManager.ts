import type { GameContext } from "../games/core/Game";
import type { GameDefinition, GameSettings } from "../games/core/GameDefinition";
import { el } from "./dom";
import { GameSessionView } from "./GameSessionView";

/**
 * Las partidas abiertas en esta página. Cada una es un objeto Game distinto,
 * con su propio matchId, así que pueden correr varias a la vez (incluso del
 * mismo juego) sin mezclar estado ni eventos.
 */
export class SessionManager {
  readonly element = el("div", "sessions");
  private readonly empty = el("p", "muted", "No hay partidas abiertas. Elige un juego arriba.");
  private readonly views = new Set<GameSessionView>();

  /** newContext se llama al abrir cada partida: toma el nombre de jugador vigente y el destino de eventos del juego. */
  constructor(private readonly newContext: (definition: GameDefinition) => GameContext) {
    this.element.append(this.empty);
  }

  open(definition: GameDefinition, settings: GameSettings = {}, replacing?: GameSessionView): void {
    if (!definition.create) return;

    const context = this.newContext(definition);
    const game = definition.create(context, settings);
    const view = new GameSessionView(definition, game, settings, context.playerId, {
      onClose: (v) => this.close(v),
      // Una acción al terminar (siguiente nivel, revancha...) abre una partida NUEVA en el mismo lugar.
      onFollowUp: (v, next) => this.open(definition, next, v),
    });
    this.views.add(view);
    this.empty.remove();

    if (replacing) {
      replacing.game.dispose();
      replacing.element.replaceWith(view.element);
      this.views.delete(replacing);
    } else {
      this.element.append(view.element);
    }

    game.start();
    view.focus();
  }

  /** Abandona todas las partidas en curso (al cerrar la pestaña), para que GameStats las cierre de una vez. */
  abandonAll(): void {
    for (const view of this.views) view.game.abandon();
  }

  private close(view: GameSessionView): void {
    view.game.dispose();
    view.element.remove();
    this.views.delete(view);
    if (this.views.size === 0) this.element.append(this.empty);
  }
}
