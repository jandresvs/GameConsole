import { el } from "../../console/dom.ts";
import type { GameSettingsForm } from "../Game.ts";
import type { Mode } from "./ChaseMatch.ts";
import { DIFFICULTIES, type Difficulty, isDifficulty } from "./Pace.ts";

export interface ChaseSettings {
  mode: Mode;
  /** Solo cuenta contra la IA. */
  difficulty: Difficulty;
  /** Nombre de la segunda persona; solo cuenta en humano contra humano. */
  player2: string;
}

export const DEFAULT_SETTINGS: ChaseSettings = { mode: "vs-cpu", difficulty: "normal", player2: "jugador2" };

/** Los controles que se muestran antes de empezar: modo, dificultad y nombre del segundo jugador. */
export class ChaseSettingsForm implements GameSettingsForm {
  readonly element: HTMLElement;
  private readonly mode = el("select");
  private readonly difficulty = el("select");
  private readonly player2 = el("input");
  private readonly difficultyRow: HTMLElement;
  private readonly player2Row: HTMLElement;

  constructor() {
    this.mode.append(new Option("Contra la IA (Prolog)", "vs-cpu"), new Option("Humano contra humano", "vs-human"));
    for (const [value, { label, cpuIntervalMs }] of Object.entries(DIFFICULTIES)) {
      this.difficulty.append(new Option(`${label} (la IA mueve cada ${cpuIntervalMs / 1000} s)`, value));
    }
    this.difficulty.value = DEFAULT_SETTINGS.difficulty;
    this.player2.value = DEFAULT_SETTINGS.player2;
    this.player2.maxLength = 24;

    this.difficultyRow = el("label", "setting", "Dificultad ", this.difficulty);
    this.player2Row = el("label", "setting", "Segundo jugador ", this.player2);
    this.element = el("div", "settings", el("label", "setting", "Modo ", this.mode), this.difficultyRow, this.player2Row);
    this.mode.addEventListener("change", () => this.sync());
    this.sync();
  }

  read(): ChaseSettings {
    const difficulty = isDifficulty(this.difficulty.value) ? this.difficulty.value : DEFAULT_SETTINGS.difficulty;
    return {
      mode: this.mode.value === "vs-human" ? "vs-human" : "vs-cpu",
      difficulty,
      player2: this.player2.value.trim() || DEFAULT_SETTINGS.player2,
    };
  }

  private sync(): void {
    const versusHuman = this.mode.value === "vs-human";
    this.difficultyRow.hidden = versusHuman;
    this.player2Row.hidden = !versusHuman;
  }
}
