import type { EventSender } from "../events/types";
import type { Game, GameSettingsForm } from "../games/Game";
import { ChaseGame } from "../games/chase/ChaseGame";
import { ChaseSettingsForm } from "../games/chase/ChaseSettingsForm";

export type GameStatus = "pendiente" | "listo";

/** Lo que la consola le entrega a un juego al crear una partida. */
export interface GameContext {
  readonly playerId: string;
  readonly sender: EventSender;
}

export interface GameEntry {
  /** gameId del contrato de GameStats: en minúsculas, Scala elige el analizador con él. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: GameStatus;
  /** Crea una partida nueva. Solo los juegos con status "listo" la traen. */
  readonly create?: (context: GameContext, settings?: GameSettingsForm) => Game;
  /** Controles de configuración que se muestran en la tarjeta (modo, dificultad...). */
  readonly settingsForm?: () => GameSettingsForm;
}

/**
 * Los juegos que la consola sabe ofrecer. Cuando exista la clase base de los
 * juegos (tarea 2), cada entrada traerá además la fábrica que crea una partida.
 */
export class GameCatalog {
  private readonly entries: readonly GameEntry[] = [
    {
      id: "combat",
      title: "Combat",
      description: "Arena vista desde arriba: disparos, daño y eliminaciones contra bots.",
      status: "pendiente",
    },
    {
      id: "racing",
      title: "Racing",
      description: "Carrera por vueltas contra pilotos automáticos, con choques que cuestan tiempo.",
      status: "pendiente",
    },
    {
      id: "chase",
      title: "Chase",
      description: "Carrera en tiempo real hacia la salida del mapa: contra una IA que decide con Prolog (con dificultad) o humano contra humano.",
      status: "listo",
      settingsForm: () => new ChaseSettingsForm(),
      create: (context, form) =>
        new ChaseGame({
          playerId: context.playerId,
          sender: context.sender,
          settings: form instanceof ChaseSettingsForm ? form.read() : undefined,
        }),
    },
  ];

  all(): readonly GameEntry[] {
    return this.entries;
  }

  find(id: string): GameEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }
}
