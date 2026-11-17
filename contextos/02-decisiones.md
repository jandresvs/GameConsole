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
| Identificadores en el código | En inglés; comentarios, textos y documentación en español | Igual que en GameStats. |

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
- **Identidad del jugador:** propuesta: el usuario escribe un nombre en la
  consola, se guarda en el navegador y se usa como `playerId`.
- **Dónde se despliega:** falta definir la máquina o el entorno.
- **Lenguaje:** el enunciado da libertad explícita. Si el profesor espera un
  lenguaje orientado a objetos "clásico", hay que saberlo ya.
