import type { Game, MatchResult } from "../games/core/Game";
import type { GameDefinition } from "../games/core/GameDefinition";
import { el } from "./dom";

/** El recuadro de UNA partida abierta: título, estado, el lienzo del juego y el botón para cerrarla. */
export class GameSessionView {
  readonly element: HTMLElement;
  private readonly status = el("span", "badge up", "en curso");
  private readonly closeButton = el("button", "secondary", "Abandonar y cerrar");

  constructor(
    definition: GameDefinition,
    readonly game: Game,
    onClose: (view: GameSessionView) => void,
  ) {
    const shortId = game.matchId.slice(-8);

    this.closeButton.addEventListener("click", () => onClose(this));
    game.onFinish((result) => this.showResult(result));

    this.element = el(
      "article",
      "session",
      el("div", "session-head", el("h3", "", definition.title), el("code", "", `partida …${shortId}`), this.status),
      game.element,
      el("p", "muted small", definition.controls ?? ""),
      el("div", "actions", this.closeButton),
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
  }
}
