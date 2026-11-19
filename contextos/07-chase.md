# 07 · Juego `chase`

Cómo funciona y cómo está organizado el código (`console-web/src/games/chase/`).

## Reglas

- **Carrera en tiempo real** (sin turnos) por **un mismo mapa** hacia la **salida (S)**, que siempre está en un **borde**.
  Todos empiezan en la misma celda. Mapa por defecto: 10×14, 22 % de obstáculos, 3 vidas.
- Antes de empezar hay una cuenta regresiva de 3 s.
- **Niveles (contra la IA):** son 4, de Fácil a Experto, y cada uno es una **partida nueva** (otro `matchId`, con sus
  propios `MATCH_STARTED` y `MATCH_FINISHED`). Al terminar aparecen botones: si ganas, «Siguiente nivel» y
  «Reintentar este nivel»; si pierdes, «Reintentar este nivel» y «Siguiente nivel». Tras el último nivel,
  «Volver al nivel 1». En humano contra humano el botón es «Revancha (mapa nuevo)».
- **Dos modos**, que se eligen en la tarjeta del juego:
  - **Contra la IA** (usa Prolog) con **dificultad**: la IA mueve sola cada 1 s (Fácil), 0,7 s (Normal),
    0,5 s (Difícil) o 0,35 s (Experto). Cuanto más difícil, más rápido.
  - **Humano contra humano** en el mismo teclado: jugador 1 con WASD y jugador 2 con las flechas
    (también hay botones en pantalla).
- **Una persona no puede moverse más de una vez cada 0,5 s**: las teclas que llegan antes de tiempo se
  ignoran (no se acumulan). Una barra junto al nombre muestra la recarga. Mantener la tecla pulsada
  avanza una celda cada 0,5 s.
- Chocar con un obstáculo cuesta **una vida y esos 0,5 s** (no se mueve). Contra el borde del mapa no pasa nada.
  Sin vidas, esa persona queda **eliminada** (la IA nunca choca: Prolog le da rutas sin obstáculos).
- Gana quien llega primero a la salida. Si todas las personas se eliminan y no hay IA, termina **sin ganador**.
- La IA **no usa azar**: en cada paso pregunta a Prolog la ruta desde su celda y ejecuta `path[0]`.
  Si Prolog no responde, el juego avisa en pantalla y **reintenta**.
- El mapa lo valida Prolog: se genera uno al azar y se le pide la ruta desde el inicio; si no hay camino
  (o es demasiado corto) se genera otro. Esa misma ruta alimenta `ROUTE_COMPUTED` de todos los jugadores.

## Clases (programación orientada a objetos)

| Clase | Responsabilidad |
|---|---|
| `Position` | Celda inmutable; `step(direction)` devuelve otra. |
| `Board` | Tamaño, obstáculos (encapsulados), inicio y salida en un borde. `Board.generate` arma un mapa al azar. |
| `Racer` (abstracta) | Posición, vidas, pasos y giros de quien corre. |
| `HumanRacer` | Hereda de `Racer`; agrega el cooldown de 0,5 s (`isReady`, `markAction`, `readiness`). |
| `CpuRacer` | Hereda de `Racer`; agrega su intervalo y `chooseMove`, que le pide la ruta a Prolog. |
| `LevelProgress` | En qué nivel va el jugador contra la IA; `advance()` sube un nivel y tras el último vuelve al primero. |
| `Pace` | Constantes de tiempo: cooldown humano y velocidad de la IA por dificultad. |
| `Clock` / `SystemClock` | El tiempo se inyecta: en las pruebas se usa un reloj manual. |
| `RouteFinder` (interfaz) | Abstracción de "quien encuentra rutas"; el juego no sabe de HTTP. |
| `PrologRouteFinder` | Implementación que llama a `POST /api/prolog/route`, con reintentos. |
| `MapBuilder` | Genera mapas hasta que Prolog confirma que tienen ruta. |
| `ChaseEvents` | Traduce lo que ocurre a eventos de GameStats. Cada instancia lleva su `matchId`. |
| `ChaseMatch` | Las reglas y el estado de una partida en tiempo real, sin pantalla. Por eso se puede probar sola. |
| `ChaseGame` (hereda de `Game`) | Conecta la partida con el DOM: teclado, HUD y mensajes. |
| `ChaseRenderer`, `ChaseSettingsForm` | Dibujo en canvas y controles de modo/dificultad. |

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
npm test      # 35 pruebas: mapa, cooldown, dificultad, IA con Prolog, eventos, partidas simultáneas
```

Se probó también de punta a punta (navegador, Prolog real e ingest de GameStats real): una persona ganó
siguiendo la ruta de Prolog; de 30 teclas en 2,5 s solo se aceptaron 5 (intervalos de 501 ms o más); dos partidas
contra la IA a la vez; 82 eventos recibidos con 0 rechazados, duplicados ni tardíos.

## Limitaciones conocidas

- **Humano contra humano es local** (mismo teclado y misma pestaña). Jugar en computadoras distintas
  necesitaría un servidor que sincronice a los dos, y la arquitectura acordada no tiene código de servidor propio.
- Falta verlo con el GameStats completo (Scala) y actualizar la sección 2.4 de `CONTRACT.md` en la v1.1.
