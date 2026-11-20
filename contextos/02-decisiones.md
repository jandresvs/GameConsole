# 02 · Decisiones

## Tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Juegos | `combat`, `racing` y `chase` | Ya tienen contrato y analizador propio en GameStats. Un juego nuevo solo tendría los conteos del analizador genérico. |
| Dónde corren los juegos | En el navegador, en **TypeScript** con clases | Cada pestaña es independiente, así que las partidas en paralelo casi no cuestan. El paso de compilación sirve para el CI. |
| Dibujo | Canvas 2D, sin framework | No hay tiempo para aprender nada nuevo. |
| Servidor de la consola | **nginx**: entrega la página y reenvía `/api/...` | GameStats no tiene CORS; con el proxy el navegador habla con un solo origen. No hay código de servidor propio. |
| Prolog | **SWI-Prolog** en su propio contenedor, con un endpoint HTTP | El enunciado pide contenerizar el intérprete. Sin estado: recibe el tablero y devuelve la jugada. |
| Mecánica de `chase` | **Carrera contra la CPU**: el usuario y una segunda Buena controlada por Prolog compiten por alcanzar primero a La Mala | Cumple "usuario contra computadora" y, según el código del analizador de Scala, funciona sin cambiarlo porque ya calcula por jugador. |
| Repositorio | Repo nuevo `GameConsole`; GameStats se usa como **imágenes publicadas** | Mantiene a GameStats como plataforma externa. |
| Deployment | Imágenes en ghcr.io por release, más `docker compose` | Lo mismo que se hizo en GameStats. |
| Identidad del jugador | El usuario escribe un nombre en la consola; se normaliza (minúsculas, sin tildes ni espacios), se guarda en el navegador y se usa como `playerId` | Simple y suficiente; no hay cuentas ni contraseñas. |
| Identificadores de eventos | `matchId` = `<gameId>-<uuid>`; `eventId` = `<matchId>-<número>` | El mismo formato de `eventId` que usa el simulador de GameStats: legible y único. |
| Identificadores en el código | En inglés; comentarios, textos y documentación en español | Igual que en GameStats. |

### Decisiones de `racing`

| Tema | Decisión | Por qué |
|---|---|---|
| Rivales | Tres bots que avanzan sobre la línea central, cada uno con su velocidad máxima y su agarre en curva | Son predecibles y no se salen de la pista. No hace falta Prolog: el juego contra la CPU con Prolog es `chase` |
| Choques entre autos | No hay: los autos se atraviesan | Simplifica mucho y evita que un bot bloquee al usuario |
| Choque con el muro | A más de 70 px/s el auto se detiene entre 0,9 y 2,4 s; más lento, solo raspa | Castiga entrar rápido a una curva sin frustrar al rozar el borde |
| Fin de la carrera | Cuando todos terminan, o 30 s después del primero; quien no llegó queda sin terminar | Una carrera no puede quedar abierta si el usuario se pierde |
| Aleatoriedad | `Random` con semilla en vez de `Math.random()` | Con la misma semilla la carrera se repite igual, y así se puede probar |

### Decisiones de `combat`

| Tema | Decisión | Por qué |
|---|---|---|
| Modo | Todos contra todos: el usuario y tres bots | Los bots también se eliminan entre sí, así hay estadísticas para todos |
| Fin | Gana el primero en llegar a 8 eliminaciones; si se acaban los 3:00, el líder; empate = sin ganador | Con 5 la partida duraba ~30 s; con 8 dura entre 40 y 80 s y aparecen rachas y remontadas |
| Disparos | Cada disparo es un proyectil que impacta a lo sumo a uno | Scala calcula la precisión como impactos / disparos: así nunca pasa de 100 % |
| Escopeta | Un solo proyectil de 50 de daño y corto alcance, no perdigones | Varios perdigones por disparo darían más impactos que disparos |
| `amount` | El daño que realmente quitó (nunca más que la vida que quedaba) | En cada vida, los impactos suman exactamente 100 |
| Reaparición | A los 2 s, en el punto más alejado de los vivos, con 1 s de protección | Evita que eliminen a alguien apenas reaparece |
| Rivales | Bots con reglas: el enemigo visible más cercano, error de puntería, distancia ideal según el arma | Predecibles y sin Prolog, igual que en `racing` |
| Controles | WASD o flechas para moverse; el ratón apunta y el clic dispara | Es lo esperable en un juego de disparos visto desde arriba |

### Alternativa descartada para `chase`

Que La Mala huya controlada por Prolog. Se siente más como un rival, pero hay
que inventar una regla para que sea alcanzable, y la estadística de eficiencia
(pasos óptimos contra pasos usados) pierde sentido cuando el objetivo se mueve.
Queda como mejora solo si sobra tiempo.

## Lo que encontramos en GameStats y cómo nos afecta

- **Sin CORS.** Ni Go ni Scala lo tienen, y el panel de GameStats solo reenvía
  GET. Por eso existe el proxy de nginx.
- **Timeout de inactividad.** El ingest cierra una partida tras 30 s sin
  eventos y descarta los siguientes como tardíos. Eso está pensado para el
  simulador; una persona puede quedarse quieta más tiempo. En nuestro compose
  `IDLE_TIMEOUT` vale 5 minutos. Consecuencia: una partida abandonada (pestaña
  cerrada) tarda 5 minutos en aparecer en los resultados.
- **Las estadísticas salen al terminar la partida.** Go entrega la partida
  completa a Scala cuando llega `MATCH_FINISHED`. Durante la partida lo único
  que cambia en vivo son los contadores de `/status`.
- **No hay consulta de instancias por juego.** Scala expone partidas y
  jugadores; Go solo el total de partidas abiertas. Como la consola no puede
  calcular, hay que agregarlo a GameStats (el enunciado lo permite):
  - Go: partidas abiertas y entregadas por `gameId` en `/status`.
  - Scala: un resumen por juego y general, por ejemplo `GET /results/games`.
  - Se publica como GameStats **v1.1**.
- **Los resultados viven en memoria.** Al reiniciar GameStats se pierden. Es
  aceptable para la demostración.
- **Reintentar es seguro.** Go descarta eventos con un `eventId` repetido dentro
  de la misma partida, así que reenviar un lote no duplica nada.

## Abiertas

- **Reparto de tareas:** hay una propuesta en `06-reparto.md`; falta confirmarla.
- **Código Prolog anterior:** Jean tiene el A\* del proyecto Java + Prolog; falta
  traerlo y adaptarlo al contrato de `05-prolog.md`.
- **Dónde se despliega:** falta definir la máquina o el entorno.
- **Lenguaje:** el enunciado da libertad explícita. Si el profesor espera un
  lenguaje orientado a objetos "clásico", hay que saberlo ya.
