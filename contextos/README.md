# Contextos

Esta carpeta guarda los **acuerdos del proyecto**: qué hay que entregar, qué
decidimos y por qué, cómo encajan las piezas y quién hace qué. Sirve para que
cualquiera de los dos pueda retomar el trabajo sin tener que preguntar.

Leer en este orden:

| Archivo | Qué contiene |
|---|---|
| [`01-enunciado.md`](01-enunciado.md) | Resumen de lo que pide el enunciado y la fecha de entrega |
| [`02-decisiones.md`](02-decisiones.md) | Decisiones tomadas, con su razón, y lo que sigue abierto |
| [`03-arquitectura.md`](03-arquitectura.md) | Servicios, puertos, rutas del proxy y estructura del repo |
| [`04-eventos.md`](04-eventos.md) | Reglas para emitir eventos y qué eventos emite cada juego |
| [`05-prolog.md`](05-prolog.md) | Contrato propuesto del servicio Prolog |
| [`06-reparto.md`](06-reparto.md) | Tareas de cada uno, criterio de "listo" y calendario |
| [`07-contrato-juegos.md`](07-contrato-juegos.md) | Cómo escribir un juego: la clase base `Game` y sus reglas |
| [`08-chase.md`](08-chase.md) | Reglas y clases del juego `chase` |

## Estado actual (18 de noviembre)

Hecho:

- El **esqueleto** (A1): página de consola, proxy hacia GameStats y Prolog, un
  servicio Prolog que solo responde `/health`, el compose y un CI básico.
- El **contrato entre la consola y los juegos** (A2): la clase base `Game`, la
  consola abre varias partidas a la vez o en otra pestaña, y hay un juego de
  ejemplo solo para desarrollo.
- La **capa de eventos** (A3): los eventos de los juegos llegan a GameStats,
  con cola, envío por lotes, reintentos y envío al cerrar la pestaña.
- **`racing`** (A4): el usuario contra tres bots, a tres vueltas. Sirve de
  ejemplo completo de cómo se escribe un juego (ver `07-contrato-juegos.md`).
- **`combat`** (A5): todos contra todos en una arena, el usuario contra tres
  bots, hasta 8 eliminaciones.

- **El servicio Prolog, `chase` y el panel** (J1, J2 y J4, Jean): A\* en
  `ai-prolog/route.pl`, `chase` contra la CPU que decide con Prolog, y el panel
  de estadísticas que consulta GameStats cada 2 s. `chase` ya está integrado
  sobre la clase `Game` y la capa de eventos.

Sigue: GameStats v1.1 con el resumen por juego en Scala (J3, ya escrito) y las
instancias por juego en Go (A6), que el panel necesita; CI/CD y deployment (A7);
prueba de concurrencia, documentación y video.

## Reglas de esta carpeta

- Si un acuerdo cambia, se cambia aquí en el mismo commit que el código.
- Lo que está marcado como **propuesta** todavía no lo hemos confirmado los dos.
- El contrato de eventos oficial sigue siendo `docs/CONTRACT.md` del repo de
  GameStats. Aquí solo se resume lo que GameConsole necesita.
