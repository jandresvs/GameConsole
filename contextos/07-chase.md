# 07 · Juego `chase`

Cómo funciona y cómo está organizado el código (`console-web/src/games/chase/`).

## Reglas

- Carrera **por turnos**: el usuario (**B**) y una segunda Buena controlada por Prolog (**C**, `playerId` `cpu`)
  compiten por llegar primero a La Mala (**M**, fija). Tablero por defecto: 8×12, 20 % de obstáculos, 3 vidas.
- Teclas: flechas o WASD (también hay botones). Tras cada jugada del usuario mueve la CPU.
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
| `ChaseEvents` | Traduce lo que ocurre a eventos de GameStats. Cada instancia lleva su `matchId`. |
| `ChaseMatch` | Las reglas y el estado de una partida, sin pantalla. Por eso se puede probar sola. |
| `ChaseGame` (hereda de `Game`) | Conecta la partida con el DOM: canvas, teclado, mensajes. |
| `ChaseRenderer` | Dibuja el tablero en canvas. |

`Game` (`games/Game.ts`) y `EventSender` (`events/types.ts`) son **provisionales**: se escribieron para poder
construir `chase` y se ajustan cuando Andrés publique A2 y A3. `BasicEventSender` es un emisor mínimo
(cola, lotes, reintento con el mismo `eventId`) que A3 reemplaza.

## Partidas en paralelo

Cada partida es un objeto con su propio estado y `matchId` (`chase-<uuid>`). En una misma consola comparten
el emisor, pero cada evento lleva su `matchId`. "Abrir en otra pestaña" usa `?game=chase`: otra pestaña es otro
programa, con su propio emisor.

## Pruebas

```bash
cd console-web
npm test      # 20 pruebas: tablero, reglas, eventos, partidas simultáneas, cliente de Prolog
```

Se probó también de punta a punta (navegador, Prolog real e ingest de GameStats real): 4 partidas simultáneas,
84 eventos recibidos y 0 rechazados, duplicados ni tardíos.

## Pendiente

- Probarlo con GameStats completo (Scala) y confirmar que `ChaseAnalyzer` calcula bien con dos jugadores.
- Actualizar la sección 2.4 de `CONTRACT.md` en la v1.1 (ahora hay dos jugadores por partida).
