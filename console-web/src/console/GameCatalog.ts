export type GameStatus = "pendiente" | "listo";

export interface GameEntry {
  /** gameId del contrato de GameStats: en minúsculas, Scala elige el analizador con él. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: GameStatus;
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
      description: "La Buena vs La Mala: carrera contra una CPU que decide su ruta con Prolog (A*).",
      status: "pendiente",
    },
  ];

  all(): readonly GameEntry[] {
    return this.entries;
  }
}
