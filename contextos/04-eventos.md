# 04 · Eventos

La referencia oficial es `docs/CONTRACT.md` del repo de GameStats (secciones 2 y
6). Esto es el resumen de lo que GameConsole tiene que cumplir.

## Cómo se envían

`POST /api/ingest/events` con un arreglo JSON de eventos. Pueden ir mezclados de
varias partidas y juegos. Respuesta `202` con cuántos se aceptaron y cuáles se
rechazaron, cada uno con su motivo.

## Formato

```json
{
  "eventId": "0b8f6c1e-...",
  "timestamp": "2026-11-18T15:04:05.123Z",
  "gameId": "racing",
  "gameVersion": "1.0",
  "matchId": "racing-7c2a...",
  "playerId": "andres",
  "type": "LAP_COMPLETED",
  "data": { "lap": 1, "lapTimeMs": 61230 }
}
```

| Campo | Regla |
|---|---|
| `eventId` | Obligatorio y único. Usar `newId()` de `src/events/ids.ts`. |
| `timestamp` | Obligatorio, UTC terminado en `Z`. `new Date().toISOString()` ya lo cumple. |
| `gameId` | Obligatorio, en minúsculas: `combat`, `racing` o `chase`. |
| `matchId` | Obligatorio y único por partida. Propuesta: `<gameId>-<uuid>`. |
| `type` | Obligatorio, `MAYUSCULAS_CON_GUION_BAJO`. |
| `playerId` | Opcional; si va, no puede estar vacío. No va en `MATCH_STARTED` ni `MATCH_FINISHED`. |
| `data` | Opcional; si va, es un objeto. Los números van como número, no como texto. |

## Reglas que hay que respetar

- **`MATCH_FINISHED` cierra la partida.** Cualquier evento posterior con ese
  `matchId` se descarta como tardío. Tiene que ser el último que se envía.
- **Un `matchId` pertenece a un solo `gameId`.**
- **Reintentar con el mismo `eventId`.** Go descarta el repetido, así que
  reenviar un lote tras un fallo de red es seguro. Nunca generar un `eventId`
  nuevo para un evento que ya se intentó enviar.
- **Cinco minutos sin eventos cierran la partida** (`IDLE_TIMEOUT` del compose).
- Los bots y la CPU también son jugadores: aparecen en las estadísticas con su `playerId`.

## Eventos por juego

Comunes a los tres: `MATCH_STARTED`, `PLAYER_JOINED` (uno por jugador) y
`MATCH_FINISHED` con `data.winnerId` si hubo ganador.

### `combat`

| `type` | `playerId` | `data` |
|---|---|---|
| `SHOT_FIRED` | quien dispara | `weapon` |
| `DAMAGE_DEALT` | quien ataca | `target`, `amount` (número), `weapon` |
| `PLAYER_ELIMINATED` | **quien elimina** | `victimId`, `weapon` |

Con eso Scala calcula K/D, precisión, daño promedio y los patrones
`KILL_STREAK` y `COMEBACK`.

### `racing`

| `type` | `playerId` | `data` |
|---|---|---|
| `MATCH_STARTED` | – | `track`, `laps` |
| `CRASH` | piloto | `lap`, `timeLostMs` |
| `LAP_COMPLETED` | piloto | `lap`, `lapTimeMs` (**ya incluye** el tiempo perdido en choques) |
| `MATCH_FINISHED` | – | `winnerId` = piloto con menor tiempo total |

Las posiciones no se envían: Scala las reconstruye con los tiempos. Patrones:
`FASTEST_LAP`, `COMEBACK`, `CLEAN_RACE`.

### `chase`

| `type` | `playerId` | `data` |
|---|---|---|
| `MATCH_STARTED` | – | `rows`, `cols`, `obstaclePct`, `lives` |
| `ROUTE_COMPUTED` | jugador | `found`, `start` y `goal` (`{row, col}`), y si hay ruta: `optimalSteps`, `routeTurns` |
| `PLAYER_MOVED` | jugador | `row`, `col` (celda de llegada), `direction`, `turn` (si cambió de dirección) |
| `OBSTACLE_HIT` | jugador | `row`, `col`, `livesLeft` |
| `TARGET_REACHED` | jugador | `steps`, `turns` |
| `MATCH_FINISHED` | – | `winnerId` = quien alcanzó primero a La Mala |

Coordenadas `(row, col)` desde 0. Direcciones: `arriba`, `abajo`, `izquierda`, `derecha`.

**Cambio respecto al contrato actual:** el contrato dice "un solo jugador por
partida". Con la carrera contra la CPU habrá dos: el usuario y `cpu`. Cada uno
emite su propio `ROUTE_COMPUTED`, sus `PLAYER_MOVED` y, si llega,
su `TARGET_REACHED`. Leyendo `ChaseAnalyzer.scala`, todo se calcula por
`playerId`, así que debería funcionar sin tocarlo. **Falta comprobarlo con una
partida real** y actualizar la sección 2.4 de `CONTRACT.md` en la v1.1.

Los valores de `ROUTE_COMPUTED` (pasos óptimos y giros) salen del servicio
Prolog, tanto para la CPU como para el usuario.
