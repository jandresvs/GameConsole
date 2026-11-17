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

## Estado actual (16 de noviembre)

Hecho: el **esqueleto** (tarea 1 de Andrés). Hay una página de consola sin
juegos, el proxy hacia GameStats y Prolog, un servicio Prolog que solo responde
`/health`, el compose y un CI básico.

Sigue: la clase base de los juegos y la capa de eventos (Andrés), y el servicio
Prolog con A\* (Jean), que no depende de lo anterior.

## Reglas de esta carpeta

- Si un acuerdo cambia, se cambia aquí en el mismo commit que el código.
- Lo que está marcado como **propuesta** todavía no lo hemos confirmado los dos.
- El contrato de eventos oficial sigue siendo `docs/CONTRACT.md` del repo de
  GameStats. Aquí solo se resume lo que GameConsole necesita.
