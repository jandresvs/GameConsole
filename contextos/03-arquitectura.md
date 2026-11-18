# 03 · Arquitectura

```
 Navegador (TypeScript)                  Contenedores (docker compose)
┌───────────────────────────┐
│ Consola: elegir juegos,   │        ┌──────────────┐      ┌─────────────────────────┐
│ varias partidas a la vez  │        │   console    │ ───► │ ingest   (GameStats Go) │──┐ POST /analyze
│ Juegos: combat, racing,   │ ─────► │ nginx :3000  │ ───► │ analyzer (GameStats Scala)◄┘
│ chase (clases)            │ /api/… │ página+proxy │ ───► │ prolog   (SWI-Prolog)   │
│ Envío de eventos          │        └──────────────┘      └─────────────────────────┘
│ Panel de estadísticas     │
└───────────────────────────┘
```

El navegador **solo** habla con `console`. Todo lo demás pasa por el proxy.

## Servicios y puertos

| Servicio | Qué es | Puerto en la máquina | Origen |
|---|---|---|---|
| `console` | nginx: página compilada y proxy | 3000 (`CONSOLE_PORT`) | `console-web/` |
| `prolog` | SWI-Prolog con servidor HTTP | 8082 | `ai-prolog/` |
| `ingest` | GameStats, módulo Go | 8080 | imagen `ghcr.io/ssanscarlos-rgb/gamestats-go` |
| `analyzer` | GameStats, módulo Scala | 8081 | imagen `ghcr.io/ssanscarlos-rgb/gamestats-analyzer` |
| `gamestats-dashboard` | Panel original de GameStats, solo para depurar | 8090 | perfil `debug` |

La versión de GameStats se elige con `GAMESTATS_VERSION` (por defecto `v1.0`).

Los puertos 8080 y 8081 son los mismos que usa el compose de GameStats: no se
pueden tener los dos proyectos levantados a la vez en la misma máquina.

## Rutas del proxy

| El navegador pide | Llega a | Métodos |
|---|---|---|
| `/api/ingest/...` | `ingest:8080/...` | GET y POST |
| `/api/analyzer/...` | `analyzer:8081/...` | **solo GET** |
| `/api/prolog/...` | `prolog:8082/...` | GET y POST |

`/api/analyzer` es de solo lectura a propósito: los eventos entran siempre por
el ingest, nunca directo a Scala. Si un servicio está caído, el proxy responde
`502 {"error":"servicio no disponible"}`.

En desarrollo (`npm run dev`) Vite hace el mismo reenvío, definido en
`console-web/vite.config.ts`. En el código siempre se usan las rutas de
`src/config.ts`, nunca `localhost:8080`.

## Estructura del repo

```
GameConsole/
├── docker-compose.yml          sistema completo
├── contextos/                  estos acuerdos
├── console-web/                la consola (TypeScript + Vite) y nginx
│   ├── Dockerfile              compila y deja la página dentro de nginx
│   ├── nginx.conf              página + proxy /api/...
│   ├── vite.config.ts          proxy de desarrollo
│   └── src/
│       ├── main.ts             punto de entrada
│       ├── config.ts           rutas de la API
│       ├── console/            la pantalla principal: catálogo, partidas abiertas, jugador
│       ├── games/
│       │   ├── core/           clase base Game, GameDefinition, teclado y Random
│       │   ├── example/        juego de ejemplo (solo desarrollo)
│       │   ├── racing/         racing: pista, autos, reglas de carrera y dibujo
│       │   ├── combat/         combat: arena, armas, luchadores, reglas y dibujo
│       │   └── chase/          chase: tablero, corredores, cliente de Prolog y reglas
│       ├── events/             eventos por partida (MatchEvents) y su envío a GameStats (HttpEventSink)
│       ├── services/           estado de los servicios
│       └── dashboard/          panel de estadísticas (consulta GameStats cada 2 s)
├── ai-prolog/                  servicio Prolog
│   ├── Dockerfile
│   ├── server.pl               servidor HTTP: /health y /route
│   ├── route.pl                A* (la búsqueda)
│   └── test_route.pl           pruebas de route.pl
└── .github/workflows/ci.yml    compila la consola y construye las imágenes
```

## Cómo se evita mezclar partidas

- Cada partida es un objeto `Game` con su propio estado, su propio `matchId` y su propio teclado
  (ver `07-contrato-juegos.md`).
- El servicio Prolog no guarda nada entre llamadas: el juego le manda el estado completo.
- Cada pestaña del navegador es un programa aparte, con sus propias partidas.
