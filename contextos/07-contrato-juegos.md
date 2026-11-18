# 07 · Contrato entre la consola y los juegos

Cómo se escribe un juego para que la consola lo pueda ofrecer, abrir varias
veces a la vez y enviar sus eventos. Hay dos ejemplos funcionando:

- `console-web/src/games/example/ExampleGame.ts`: el mínimo, en un archivo.
- `console-web/src/games/racing/`: un juego completo de la entrega (ver abajo).

## La idea

- Cada **partida** es un objeto de una clase que extiende `Game`
  (`src/games/core/Game.ts`). Un objeto, una instancia: tiene su propio estado,
  su propio `matchId`, su propio lienzo y su propio teclado.
- La consola no conoce ningún juego. Solo maneja `GameDefinition` (qué juegos
  hay) y `Game` (una partida abierta).
- El juego no sabe cómo se envían los eventos. Llama a `this.emit(...)` y la
  clase base se encarga del resto.

## Qué hace la clase base por ti

- El ciclo de vida: `ready → running → finished`, y el bucle de juego.
- `MATCH_STARTED` y un `PLAYER_JOINED` por jugador al empezar.
- `MATCH_FINISHED` al terminar, una sola vez y siempre de último.
- `PLAYER_LEFT` del usuario si la partida se abandona (se cierra el recuadro o la pestaña).
- Ignora cualquier evento emitido después de terminar, que GameStats descartaría como tardío.
- `eventId` únicos y `timestamp` estrictamente crecientes dentro de la partida.

## Qué implementa cada juego

| Método | Para qué |
|---|---|
| `constructor(context)` | Llama a `super(gameId, context, { width, height })`. No empieza nada todavía. |
| `players()` | Devuelve los `playerId` que participan: `this.playerId` (el usuario), más bots o `cpu`. |
| `onStart()` | Prepara el estado inicial. |
| `update(dtMs)` | Avanza la partida. `dtMs` es el tiempo de juego desde el cuadro anterior. |
| `render(ctx)` | Dibuja el estado actual. No cambia estado ni emite eventos. |
| `matchStartData()` *(opcional)* | Los datos de `MATCH_STARTED` propios del juego, por ejemplo `{ track, laps }`. |
| `onKeyDown(code)` *(opcional)* | Una tecla se acaba de pulsar (acciones puntuales, juegos por turnos). |

## Qué puede usar

| Herramienta | Para qué |
|---|---|
| `this.emit(type, data?, playerId?)` | Emitir un evento del juego. Sin `playerId` es un evento de la partida. |
| `this.finish(winnerId?)` | Terminar la partida. Sin `winnerId` nadie ganó. |
| `this.playerId` | El `playerId` del usuario. |
| `this.keyboard.isDown(code)` | Si una tecla está presionada ahora (movimiento continuo). |
| `this.elapsedMs` | Reloj de la partida en milisegundos. |
| `this.isRunning` | Si la partida sigue en curso. |
| `this.width`, `this.height`, `this.canvas` | El lienzo. Para el ratón, agregar listeners a `this.canvas`. |

Las teclas se nombran con `KeyboardEvent.code`: `"ArrowUp"`, `"KeyW"`, `"Space"`.

## Reglas

1. **Medir el tiempo con `elapsedMs` o sumando `dtMs`, nunca con `Date.now()`.**
   El reloj de la partida se detiene cuando la pestaña está oculta; el del
   sistema no. Un tiempo de vuelta medido con `Date.now()` saldría enorme si
   el usuario cambia de pestaña.
2. **Después de cada `await`, revisar `this.isRunning` antes de tocar el estado.**
   La partida pudo cerrarse mientras se esperaba, por ejemplo, a Prolog.
3. **No emitir `MATCH_STARTED`, `PLAYER_JOINED` ni `MATCH_FINISHED` a mano.**
   `emit` lanza un error si se intenta.
4. **Los tipos de evento van en `MAYUSCULAS_CON_GUION_BAJO`** y los números como
   número. Los eventos y datos de cada juego están en `04-eventos.md`.
5. **Todo el estado vive en campos del objeto**, nunca en variables globales del
   módulo. Si no, dos partidas abiertas se pisarían.
6. **Las entidades del juego son clases** (tablero, auto, proyectil…), con su
   estado encapsulado. Es lo que evalúa el enunciado.

## Esqueleto de un juego

```ts
import { Game, type GameContext } from "../core/Game";
import type { GameDefinition } from "../core/GameDefinition";

export class RacingGame extends Game {
  static readonly definition: GameDefinition = {
    id: "racing",
    title: "Racing",
    description: "Carrera por vueltas contra pilotos automáticos.",
    controls: "Flechas para conducir.",
    create: (context) => new RacingGame(context),
  };

  private readonly track = new Track("ovalo", 3);
  private readonly cars: Car[] = [];

  constructor(context: GameContext) {
    super("racing", context, { width: 640, height: 400 });
  }

  protected players() {
    return [this.playerId, "bot-1", "bot-2"];
  }

  protected override matchStartData() {
    return { track: this.track.name, laps: this.track.laps };
  }

  protected onStart(): void {
    // crear los autos en la línea de salida
  }

  protected update(dtMs: number): void {
    // mover autos; cuando uno completa una vuelta:
    //   this.emit("LAP_COMPLETED", { lap, lapTimeMs }, car.playerId);
    // cuando todos terminan:
    //   this.finish(winnerId);
  }

  protected render(ctx: CanvasRenderingContext2D): void {
    // dibujar pista y autos
  }
}
```

## Registrar el juego

En `src/console/GameCatalog.ts`, reemplazar la entrada del juego por su definición:

```ts
import { RacingGame } from "../games/racing/RacingGame";
// ...
private readonly definitions: GameDefinition[] = [
  { id: "combat", ... },
  RacingGame.definition,
  { id: "chase", ... },
];
```

Con eso la tarjeta pasa a "Listo" y funcionan **Nueva partida** y **Abrir en
otra pestaña**. Cada juego va en su carpeta: `src/games/racing/`,
`src/games/combat/`, `src/games/chase/`.

## Probar mientras se desarrolla

- `npm run dev` y abrir http://localhost:5173. En desarrollo aparece una cuarta
  tarjeta, **Ejemplo**, para ver el contrato funcionando.
- La sección **Envío de eventos** muestra en vivo lo que emite cada partida de
  la pestaña (la hora sale en UTC) y si GameStats lo está aceptando.
- `npm test` corre las pruebas automáticas.
- En la versión de Docker el ejemplo no aparece, porque la entrega lleva
  exactamente tres juegos. Para verlo ahí: http://localhost:3000/?demo

## Racing como modelo para los demás juegos

`racing` separa las reglas del dibujo, y conviene copiar esa forma:

| Archivo | Qué hace | Toca el navegador |
|---|---|---|
| `Track.ts`, `tracks.ts` | La pista: geometría, curvatura, proyección de un punto | No |
| `Car.ts`, `PlayerCar.ts`, `BotCar.ts` | Los autos: uno con física y teclado, los bots con reglas | No |
| `LapTracker.ts` | Cuenta vueltas y mide sus tiempos | No |
| `Race.ts` | Las reglas de la carrera; avisa choques, vueltas y el final | No |
| `RaceRenderer.ts` | Dibuja la carrera en el canvas | Sí |
| `RacingGame.ts` | Extiende `Game`: lee el teclado, llama a `Race` y convierte sus avisos en eventos | Sí |

Como `Race` no depende del navegador, las pruebas corren carreras enteras en
milisegundos con un piloto automático (`testing/Autopilot.ts`) y revisan que
los eventos salgan como los espera el analizador de Scala.

Para números al azar, usar `Random` (`src/games/core/Random.ts`) con semilla
en vez de `Math.random()`: así una partida se puede repetir igual en una prueba.

## Cómo llegan los eventos a GameStats

El juego no hace nada especial: `this.emit(...)` entrega el evento a un
`EventSink` y ahí termina su parte. La consola conecta dos destinos:

- **`HttpEventSink`** (`src/events/HttpEventSink.ts`): encola el evento y lo
  envía por lotes a `/api/ingest/events`. Si la red falla o GameStats no
  responde, reintenta el mismo lote con esperas crecientes. Al cerrar la
  pestaña manda lo pendiente con una petición que sobrevive al cierre.
- **`LocalEventSink`**: guarda los últimos eventos para mostrarlos en la
  sección **Envío de eventos** de la consola.

En esa sección también se ve el estado del envío: cuántos eventos hay en cola,
cuántos aceptó o rechazó GameStats y cuántos reintentos hubo. Si un juego emite
un evento mal formado, GameStats lo rechaza y el motivo sale en la consola del
navegador y en `GET /api/ingest/rejected`.

El juego de ejemplo lleva `localOnly: true` en su definición: sus eventos solo
se muestran en pantalla, para que `example` no aparezca en las estadísticas.
Los tres juegos reales **no** deben llevar esa bandera.
