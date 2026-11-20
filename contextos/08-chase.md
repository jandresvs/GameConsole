<<<<<<< Updated upstream
# 08 · Juego `chase`

Cómo funciona y cómo está organizado el código (`console-web/src/games/chase/`).

## Reglas

- Carrera **por turnos**: el usuario (**B**) y una segunda Buena controlada por Prolog (**C**, `playerId` `cpu`)
  compiten por llegar primero a La Mala (**M**, fija). Tablero por defecto: 8×12, 20 % de obstáculos, 3 vidas.
- Teclas: flechas o WASD. Tras cada jugada del usuario mueve la CPU.
- Chocar con un obstáculo cuesta **una vida y el turno** (no se mueve). Contra el borde no pasa nada.
- Gana quien alcanza primero a La Mala. Sin vidas, o tablero sin ruta, o partida cerrada: termina **sin ganador**
  (`MATCH_FINISHED` sin `winnerId`, como pide el contrato).
- La CPU **no** usa azar: en cada turno pregunta a Prolog la ruta desde su celda y ejecuta `path[0]`.
  Si Prolog no responde, el juego avisa en pantalla y **reintenta** hasta que conteste.

## Clases (programación orientada a objetos)

| Clase | Responsabilidad |
|---|---|
| `Position` | Celda inmutable; `step(direction)` devuelve otra. |
| `Board` | Tamaño, obstáculos (encapsulados) y La Mala. `Board.generate` arma un tablero al azar. |
| `Racer` (abstracta) | Posición, vidas, pasos y giros de quien corre. |
| `HumanRacer`, `CpuRacer` | Subclases. `CpuRacer.chooseMove` le pide la ruta a Prolog (polimorfismo: cada tipo decide distinto). |
| `RouteFinder` (interfaz) | Abstracción de "quien encuentra rutas"; el juego no sabe de HTTP. |
| `PrologRouteFinder` | Implementación que llama a `POST /api/prolog/route`, con reintentos. |
| `ChaseEvents` | Traduce lo que ocurre a eventos de GameStats y los entrega con `this.emit` del juego. |
| `ChaseMatch` | Las reglas y el estado de una partida, sin pantalla. Por eso se puede probar sola. |
| `ChaseGame` (hereda de `Game`) | Conecta la partida con la consola: teclado, dibujo y eventos. |
| `ChaseRenderer` | Dibuja en el lienzo los datos del jugador, el tablero y el estado del turno. |

### Cómo se integró con la clase base

`chase` se escribió primero sobre versiones provisionales de la clase `Game` y del envío de eventos. Al
mezclarlo con A2 y A3 se reemplazaron por las definitivas (`games/core/Game.ts`, `HttpEventSink`):

- `ChaseGame` extiende `games/core/Game.ts`, igual que `racing` y `combat`. La base emite `MATCH_STARTED`
  (con `rows`, `cols`, `obstaclePct` y `lives`, vía `matchStartData`), un `PLAYER_JOINED` por jugador y
  `MATCH_FINISHED`.
- `ChaseMatch` ya no arma eventos: avisa a `ChaseEvents`, que emite los propios de chase con `this.emit` y
  convierte el final en `finish(winnerId)`.
- Si la partida se cierra desde afuera (botón o pestaña), la base emite `PLAYER_LEFT` y `MATCH_FINISHED`, y
  `ChaseGame` abandona `ChaseMatch`, que cancela lo que estuviera esperando a Prolog.
- El nombre `cpu` está reservado en `PlayerProfile`: si el usuario se llama así, queda `cpu_1`.
- Se quitaron las flechas en pantalla: en la consola el recuadro de cada partida es solo el lienzo, y los
  otros juegos también se juegan con teclado.
- "Abrir en otra pestaña" abre la consola con `?game=chase`, como los otros juegos.

## Partidas en paralelo

Cada partida es un objeto con su propio estado y `matchId` (`chase-<uuid>`, lo pone la clase base). En una
misma consola comparten el envío de eventos, pero cada evento lleva su `matchId`. Otra pestaña es otro
programa, con su propio envío.

## Pruebas

```bash
cd console-web
npm test      # todas las pruebas; las de chase están en src/games/chase/chase.test.ts (20)
```

Se probó también de punta a punta (navegador, Prolog real e ingest de GameStats real): 4 partidas simultáneas,
84 eventos recibidos y 0 rechazados, duplicados ni tardíos.

## Pendiente

- Probarlo con GameStats completo (Scala) y confirmar que `ChaseAnalyzer` calcula bien con dos jugadores.
- Actualizar la sección 2.4 de `CONTRACT.md` en la v1.1 (ahora hay dos jugadores por partida).
=======
# Chase (J2) — carrera en tiempo real

Carrera hacia una **casilla de salida en un borde** del mapa. Dos modos, mismo mapa para todos:
- **Contra la IA**: la IA decide cada jugada preguntándole a Prolog (A*, `POST /route`). 4 niveles = 4 dificultades; la IA mueve cada 1000 / 700 / 500 / 350 ms (facil / normal / dificil / experto).
- **Humano contra humano**: mismo teclado (J1: WASD, J2: flechas), partida local.

## Reglas
- No es por turnos: el reloj corre con `update(dtMs)` (se detiene si la pestaña se oculta). Cuenta regresiva de 3 s.
- Una persona solo se mueve cada 500 ms (tecla mantenida avanza sin chocar sola).
- Choque con obstáculo = −1 vida y espera; contra el borde del mapa no cuesta nada. 3 vidas. Gana quien llega primero a la salida.
- Al terminar, la consola ofrece: ganar → «Siguiente nivel» (tras el 4 vuelve al 1); perder → «Reintentar»; humano vs humano → «Revancha». Cada nivel es una partida nueva (matchId nuevo).

## Clases
`ChaseGame` (extiende `Game`) · `ChaseMatch` (reglas, solo avanza con `tick`) · `Board` · `Racer` / `HumanRacer` / `CpuRacer` · `MapBuilder` · `PrologRouteFinder` (implementa `RouteFinder`) · `ChaseEvents` · `ChaseRenderer` · `Levels` · `ChaseSettings`.
La consola es genérica: `GameDefinition.options` (selectores), `create(context, settings)` y `afterMatch` (botones de seguimiento).

## Eventos
`MATCH_STARTED` (rows, cols, obstaclePct, lives, mode, exit, humanCooldownMs; vs-cpu además difficulty, cpuIntervalMs, level), `PLAYER_JOINED`, `ROUTE_COMPUTED`, `PLAYER_MOVED`, `OBSTACLE_HIT`, `TARGET_REACHED`, `MATCH_FINISHED` (winnerId si lo hay).

## Limitaciones (avisar en la entrega)
- Humano contra humano es local (mismo teclado); no hay servidor de partidas.
- La IA nunca choca: Prolog le da rutas libres.
- Si Prolog no responde, se reintenta y se muestra un aviso.
>>>>>>> Stashed changes
