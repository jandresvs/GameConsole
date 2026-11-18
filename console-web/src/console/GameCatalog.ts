import { CombatGame } from "../games/combat/CombatGame";
import type { GameDefinition } from "../games/core/GameDefinition";
import { ExampleGame } from "../games/example/ExampleGame";
import { RacingGame } from "../games/racing/RacingGame";

/**
 * Los juegos que la consola ofrece. Para agregar uno: importar su definición
 * y ponerla en la lista. Mientras una entrada no tenga `create`, el juego
 * aparece como "en desarrollo".
 */
export class GameCatalog {
  private readonly definitions: GameDefinition[] = [
    CombatGame.definition,
    RacingGame.definition,
    {
      id: "chase",
      title: "Chase",
      description: "La Buena vs La Mala: carrera contra una CPU que decide su ruta con Prolog (A*).",
    },
  ];

  /** includeExample agrega el juego de ejemplo; la entrega lleva exactamente tres juegos. */
  constructor(includeExample: boolean) {
    if (includeExample) this.definitions.push(ExampleGame.definition);
  }

  all(): readonly GameDefinition[] {
    return this.definitions;
  }

  find(id: string): GameDefinition | undefined {
    return this.definitions.find((d) => d.id === id);
  }
}
