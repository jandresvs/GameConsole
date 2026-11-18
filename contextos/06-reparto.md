# 06 · Reparto y calendario

**Propuesta, por confirmar entre los dos.** Sigue lo que cada uno hizo en
GameStats: Andrés la parte de Go, Jean la de Scala y el Prolog original.

Cada tarea tiene un criterio de "listo" para saber cuándo soltarla.

## Andrés

| # | Tarea | Listo cuando | Estado |
|---|---|---|---|
| A1 | **Esqueleto**: repo, proyecto TypeScript, nginx, compose con GameStats, página de la consola | Con `docker compose up`, un evento enviado desde el navegador aparece en `/status` del ingest | Hecho (falta probarlo con Docker; ver el README) |
| A2 | **Contrato entre consola y juegos**: clase base `Game` (ciclo de vida, `matchId`, actualizar, dibujar) e interfaz `EventSender` | Jean puede escribir `ChaseGame` sin preguntar; queda explicado en esta carpeta | Hecho: ver `07-contrato-juegos.md` |
| A3 | **Capa de eventos**: arma los eventos, los encola, los envía por lotes en segundo plano y reintenta con el mismo `eventId` | Dos partidas simultáneas envían eventos y `/rejected` queda vacío | Hecho: `HttpEventSink` |
| A4 | **Juego `racing`**: el usuario contra dos o tres pilotos automáticos | Al terminar una carrera, Scala muestra vueltas, choques y patrones | Pendiente |
| A5 | **Juego `combat`**: el usuario contra bots en una arena | Scala calcula K/D y precisión de la partida | Pendiente |
| A6 | **Instancias por juego en Go**: partidas abiertas y entregadas por `gameId` en `/status` | Abrir una partida sube el contador de su juego antes de que termine | Pendiente |
| A7 | **CI/CD y deployment**: prueba de humo con el compose, publicación de imágenes por release, instrucciones | Un release deja las imágenes en Packages y el README explica cómo desplegar | CI básico hecho |

## Jean

| # | Tarea | Listo cuando | Estado |
|---|---|---|---|
| J1 | **Servicio Prolog**: A\* con el contrato de `05-prolog.md` | Responde bien con `curl` a un tablero con ruta y a uno sin ruta | Pendiente (se puede empezar ya) |
| J2 | **Juego `chase`**: tablero, La Mala fija, el usuario contra la CPU guiada por Prolog | Una partida completa aparece en Scala con estadísticas de los dos jugadores | Pendiente (ya tiene todo lo que necesita de la consola) |
| J3 | **Resumen por juego en Scala**: `GET /results/games` con datos por juego y totales | El panel muestra "por juego" y "general" sin sumar nada por su cuenta | Pendiente |
| J4 | **Panel de estadísticas** dentro de la consola, con consulta periódica | Los números cambian mientras hay partidas abiertas, sin recargar | Pendiente |

Notas:

- J1 no depende de nada: el servicio solo recibe un estado y devuelve una ruta.
- Para J4 se puede adaptar buena parte del panel de GameStats
  (`ingest-go/cmd/dashboard/web/index.html`), que ya tiene pestañas por juego.
- En `chase` hay que cubrir: tablero sin ruta, usuario sin vidas y Prolog caído.

## Los dos

- Publicar **GameStats v1.1** con A6 y J3, y actualizar `CONTRACT.md`.
- **Prueba de concurrencia**: dos partidas en la misma consola y dos en pestañas
  distintas; cada una con su `matchId` y ningún evento descartado por juego equivocado.
- **Documentación** breve: instalación, ejecución, deployment y decisiones técnicas.
- **Video** de 15 minutos o menos: los tres juegos, partidas simultáneas, la CPU
  con Prolog y el panel.

## Calendario

| Día | Andrés | Jean |
|---|---|---|
| Martes 17 | A2 y A3 (temprano, porque bloquean a Jean) | J1 |
| Miércoles 18 | A4 y A5 | J2 y J3 |
| Jueves 19 | A6 y A7 | J4 |
| Jueves 19, juntos | GameStats v1.1 y prueba de concurrencia | |
| Viernes 20 | Documentación, video y margen. Entrega antes de las 10:00 pm | |

El lado de Andrés queda más cargado. Si el miércoles va atrasado, lo primero
que se mueve a Jean es `combat` (A5).

Si algo se atrasa, se recorta la complejidad de `racing` y `combat`, no la
integración con GameStats ni Prolog.
