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
