import type { GameDefinition, GameOption, GameSettings } from "../games/core/GameDefinition";
import { el } from "./dom";

/** Los valores iniciales de las opciones de un juego. */
export function defaultSettings(definition: GameDefinition): GameSettings {
  return Object.fromEntries((definition.options ?? []).map((o) => [o.id, o.default]));
}

/** ¿Cuenta esta opción con los ajustes dados? Una opción con `onlyWhen` solo cuenta si la otra tiene ese valor. */
export function isActive(option: GameOption, settings: GameSettings): boolean {
  return !option.onlyWhen || settings[option.onlyWhen.option] === option.onlyWhen.equals;
}

/**
 * Valida unos ajustes (por ejemplo, los de la dirección ?mode=vs-human): cada
 * valor que no sea una de las opciones del juego se reemplaza por el inicial.
 */
export function sanitizeSettings(definition: GameDefinition, raw: Readonly<Record<string, string | null | undefined>>): GameSettings {
  const result: Record<string, string> = {};
  for (const option of definition.options ?? []) {
    const value = raw[option.id];
    result[option.id] = option.choices.some((c) => c.value === value) ? (value as string) : option.default;
  }
  return result;
}

/** Los ajustes que vienen en la dirección de la página (?game=chase&mode=vs-human&difficulty=dificil). */
export function settingsFromParams(definition: GameDefinition, params: URLSearchParams): GameSettings {
  const raw: Record<string, string | null> = {};
  for (const option of definition.options ?? []) raw[option.id] = params.get(option.id);
  return sanitizeSettings(definition, raw);
}

/** Los controles de ajustes de la tarjeta de un juego. La consola solo lee lo que eligió el usuario. */
export class GameOptionsView {
  readonly element: HTMLElement;
  private readonly selects = new Map<string, HTMLSelectElement>();
  private readonly rows = new Map<string, HTMLElement>();

  constructor(private readonly definition: GameDefinition) {
    const options = definition.options ?? [];
    this.element = el("div", "settings");
    this.element.hidden = options.length === 0;

    for (const option of options) {
      const select = el("select");
      select.id = `opt-${definition.id}-${option.id}`;
      for (const choice of option.choices) select.append(new Option(choice.label, choice.value));
      select.value = option.default;
      select.addEventListener("change", () => this.sync());

      const label = el("label", "", option.label);
      label.htmlFor = select.id;
      const row = el("div", "setting", label, select);
      this.selects.set(option.id, select);
      this.rows.set(option.id, row);
      this.element.append(row);
    }
    this.sync();
  }

  /** Los ajustes elegidos ahora. */
  read(): GameSettings {
    return Object.fromEntries([...this.selects].map(([id, select]) => [id, select.value]));
  }

  private sync(): void {
    const settings = this.read();
    for (const option of this.definition.options ?? []) {
      const row = this.rows.get(option.id);
      if (row) row.hidden = !isActive(option, settings);
    }
  }
}
