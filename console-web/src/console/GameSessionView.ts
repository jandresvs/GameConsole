import type { Game, MatchResult } from "../games/core/Game";
import type { GameDefinition, GameSettings } from "../games/core/GameDefinition";
import { el } from "./dom";

export interface SessionHandlers {
  readonly onClose: (view: GameSessionView) => void;
  /** El usuario eligió una acción al terminar: abrir otra partida con estos ajustes. */
  readonly onFollowUp: (view: GameSessionView, settings: GameSettings) => void;
}

/**
 * El recuadro de UNA partida abierta: título, estado, el lienzo del juego y los botones. Al terminar sin
 * haberse abandonado, los botones que ofrezca el juego (siguiente nivel, revancha...) aparecen junto a «Cerrar».
 */
export class GameSessionView {
  readonly element: HTMLElement;
  private readonly status = el("span", "badge up", "en curso");
  private readonly closeButton = el("button", "secondary", "Abandonar y cerrar");
  private readonly actions = el("div", "actions");

  constructor(
    private readonly definition: GameDefinition,
    readonly game: Game,
    private readonly settings: GameSettings,
    private readonly playerId: string,
    private readonly handlers: SessionHandlers,
  ) {
    const shortId = game.matchId.slice(-8);

    this.closeButton.addEventListener("click", () => handlers.onClose(this));
    this.actions.append(this.closeButton);
    game.onFinish((result) => this.showResult(result));

    this.element = el(
      "article",
      "session",
      el("div", "session-head", el("h3", "", definition.title), el("code", "", `partida …${shortId}`), this.status),
      game.element,
      el("p", "muted small", definition.controls ?? ""),
      this.actions,
    );
    this.element.dataset.matchId = game.matchId;
  }

  focus(): void {
    this.game.element.focus();
  }

  private showResult(result: MatchResult): void {
    this.status.className = "badge checking";
    this.status.textContent = result.abandoned
      ? "abandonada"
      : result.winnerId !== undefined
        ? `terminada · ganó ${result.winnerId}`
        : "terminada · sin ganador";
    this.closeButton.textContent = "Cerrar";

    const followUps = this.definition.afterMatch?.({ result, settings: this.settings, playerId: this.playerId }) ?? [];
    const buttons = followUps.map((followUp) => {
      const button = el("button", followUp.primary ? "" : "secondary", followUp.label);
      button.addEventListener("click", () => this.handlers.onFollowUp(this, followUp.settings));
      return button;
    });
    this.actions.prepend(...buttons);
  }
}
