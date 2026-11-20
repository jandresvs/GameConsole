# GameConsole

Consola web de videojuegos orientada a objetos con inteligencia de juego en Prolog.
Proyecto 2 del curso Lenguajes de Programación (TEC).

Tres juegos (**combat**, **racing** y **chase**) escritos con clases en TypeScript, partidas en
paralelo, una CPU que decide con **Prolog** (A\*) y un panel de estadísticas en vivo que consulta
a [GameStats](https://github.com/ssanscarlos-rgb/GameStats) (el proyecto 1).

- **Video de la demostración:** `<PEGAR AQUÍ EL LINK PÚBLICO DEL VIDEO>`
- **Integrantes:** `<NOMBRE 1>` · `<NOMBRE 2>`

## Contenido

1. [Qué pide el enunciado y dónde está](#1-qué-pide-el-enunciado-y-dónde-está)
2. [Arquitectura](#2-arquitectura)
3. [Instalación y ejecución](#3-instalación-y-ejecución)
4. [Cómo usar la consola](#4-cómo-usar-la-consola)
5. [Los juegos y la orientación a objetos](#5-los-juegos-y-la-orientación-a-objetos)
6. [Inteligencia en Prolog](#6-inteligencia-en-prolog)
7. [Eventos y envío concurrente a GameStats](#7-eventos-y-envío-concurrente-a-gamestats)
8. [Panel de estadísticas](#8-panel-de-estadísticas)
9. [Desarrollo y pruebas](#9-desarrollo-y-pruebas)
10. [CI/CD y deployment](#10-cicd-y-deployment)
11. [Decisiones técnicas](#11-decisiones-técnicas)
12. [Limitaciones conocidas](#12-limitaciones-conocidas)
13. [Estructura del repositorio](#13-estructura-del-repositorio)

## 1. Qué pide el enunciado y dónde está

| Requisito | Dónde se cumple |
|---|---|
| Tres juegos funcionales cargables desde la consola web | `combat`, `racing`, `chase` en `console-web/src/games/` |
| Programación orientada a objetos | Clase base abstracta `Game`; cada juego la extiende ([sección 5](#5-los-juegos-y-la-orientación-a-objetos)) |
| Varias instancias en paralelo (misma consola o pestañas) | Cada partida es un objeto `Game` independiente con su `matchId` ([sección 7](#7-eventos-y-envío-concurrente-a-gamestats)) |
| Usuario contra computadora con Prolog | `chase`: la CPU pregunta a `ai-prolog/` (A\*) en cada jugada ([sección 6](#6-inteligencia-en-prolog)) |
| Eventos compatibles con GameStats | `console-web/src/events/` respeta `docs/CONTRACT.md` de GameStats |
| Envío concurrente, sin bloquear | `HttpEventSink`: cola, lotes, reintentos con el mismo `eventId` |
| Panel con estadísticas por juego y generales, en vivo | `console-web/src/dashboard/`, consulta a GameStats cada 2 s ([sección 8](#8-panel-de-estadísticas)) |
| Instancias ejecutadas por juego | `pipeline.games` de `GET /status` en GameStats v1.1 |
| Docker, CI/CD y deployment | `docker-compose.yml`, `.github/workflows/`, [sección 10](#10-cicd-y-deployment) |

## 2. Arquitectura

```
 Navegador (TypeScript)                  Contenedores (docker compose)
┌───────────────────────────┐
│ Consola y panel           │        ┌──────────────┐      ┌───────────────────────────┐
│ Juegos: combat, racing,   │ ─────► │   console    │ ───► │ ingest   (GameStats, Go)  │──┐ POST /analyze
│ chase (clases)            │ /api/… │ nginx :3000  │ ───► │ analyzer (GameStats, Scala)◄──┘
│ Envío de eventos          │        │ página+proxy │ ───► │ prolog   (SWI-Prolog)     │
└───────────────────────────┘        └──────────────┘      └───────────────────────────┘
```

Los juegos **corren en el navegador**; no hay servidor de partidas. El navegador solo habla con
`console` (nginx), que entrega la página y reenvía `/api/...` a los demás servicios. Así no hace
falta CORS en GameStats.

| Servicio | Qué es | Puerto | Imagen |
|---|---|---|---|
| `console` | nginx con la página compilada y el proxy | 3000 | `gameconsole-web` (propia) |
| `prolog` | SWI-Prolog con servidor HTTP (`/health`, `/route`) | 8082 | `gameconsole-prolog` (propia) |
| `ingest` | GameStats, módulo Go: recibe y agrupa eventos | 8080 | `gamestats-go` (GameStats) |
| `analyzer` | GameStats, módulo Scala: calcula las estadísticas | 8081 | `gamestats-analyzer` (GameStats) |

| El navegador pide | Llega a | Métodos |
|---|---|---|
| `/api/ingest/...` | `ingest:8080/...` | GET y POST |
| `/api/analyzer/...` | `analyzer:8081/...` | solo GET (los eventos entran siempre por el ingest) |
| `/api/prolog/...` | `prolog:8082/...` | GET y POST |

Más detalle en [`contextos/03-arquitectura.md`](contextos/03-arquitectura.md).

## 3. Instalación y ejecución

**Requisitos:** Docker con Compose v2 y los puertos **3000, 8080, 8081 y 8082** libres. No hace
falta instalar Node ni Prolog. Como GameStats usa los puertos 8080 y 8081, no puede estar levantado
a la vez su propio compose.

> **Versión de GameStats.** El panel necesita **GameStats v1.1** (agrega `pipeline.games` en
> `/status` y `GET /results/games`). El compose la usa por defecto; con v1.0 todo funciona menos
> las instancias por juego y el resumen por juego del panel, que se ven como «—».

Hay tres maneras de ejecutarlo. Las tres terminan igual: abrir **http://localhost:3000**.

### Opción A: construir desde el código

```bash
git clone <url-del-repo>
cd GameConsole
docker compose up -d --build --wait
```

Construye la consola y Prolog, descarga GameStats (ghcr.io) y levanta todo. `--wait` espera a que
los cuatro servicios estén `healthy`.

### Opción B: usar las imágenes publicadas (sin compilar nada)

Cada release publica las imágenes propias en ghcr.io (ver [sección 10](#10-cicd-y-deployment)).
Solo hace falta el `docker-compose.yml` del repo:

```bash
git clone <url-del-repo>
cd GameConsole
docker compose pull                 # descarga las 4 imágenes
docker compose up -d --no-build     # y las levanta tal cual, sin compilar
```

Para fijar una versión concreta: `GAMECONSOLE_VERSION=v1.0 docker compose pull` (y lo mismo con `up`).

### Opción C: cargar las imágenes desde un archivo (sin registro)

El release de GitHub trae `gameconsole-images.tar.gz` con **las cuatro imágenes**. También se puede
generar con `scripts/export-images.sh`.

```bash
docker load -i gameconsole-images.tar.gz
docker compose up -d --no-build
```

(En Windows, `docker load -i` funciona igual en PowerShell; `export-images.sh` requiere Git Bash o WSL.)

### Comprobar que está bien

```bash
docker compose ps          # analyzer, ingest, prolog y console: healthy
scripts/smoke-test.sh      # prueba de humo (requiere curl y jq)
```

La prueba de humo, pasando por el proxy como el navegador, comprueba que los servicios responden,
que Prolog encuentra una ruta y detecta un tablero sin ruta, que **dos partidas simultáneas** suben
el contador de instancias mientras siguen abiertas y al terminar se entregan a GameStats, y que no
se rechazó ningún evento. Además, en la consola, la sección **Servicios** debe mostrar los tres
«en línea».

### Apagar y variables

```bash
docker compose down
```

| Variable | Por defecto | Para qué |
|---|---|---|
| `GAMESTATS_VERSION` | `v1.1` | versión de las imágenes de GameStats |
| `GAMECONSOLE_VERSION` | `latest` | versión de las imágenes propias (`gameconsole-web`, `gameconsole-prolog`) |
| `GAMECONSOLE_REGISTRY` | `ghcr.io/jandresvs` | registro donde están las imágenes propias |
| `IDLE_TIMEOUT` | `5m` | tiempo sin eventos tras el que GameStats cierra una partida |
| `CONSOLE_PORT` | `3000` | puerto de la consola en la máquina |

Panel original de GameStats, solo para depurar (eventos rechazados, flujo de eventos), en
http://localhost:8090: `docker compose --profile debug up -d`.

## 4. Cómo usar la consola

1. Escribe tu **nombre de jugador**. Se normaliza (minúsculas, sin tildes ni espacios), se guarda
   en el navegador y se usa como `playerId`. No hay cuentas ni contraseñas.
2. Elige un juego del catálogo: se abre una **partida nueva**. Puedes abrir varias a la vez, incluso
   del mismo juego, y también usar otra pestaña del navegador.
3. Mira el **panel de estadísticas** y la sección **Envío de eventos** (aceptados, en cola,
   reintentos) mientras juegas.
4. Al terminar una partida, la consola ofrece la acción que corresponda (siguiente nivel,
   reintentar, revancha). Cada una abre una partida nueva con su propio `matchId`.

| Juego | Qué es | Controles |
|---|---|---|
| **Combat** | Todos contra todos en una arena: tú contra tres bots. Gana el primero en llegar a 8 eliminaciones (o el líder a los 3:00) | WASD o flechas para moverse; el ratón apunta y el clic dispara |
| **Racing** | Carrera de 3 vueltas contra tres pilotos automáticos. Chocar con el muro cuesta tiempo | W/↑ acelerar, S/↓ frenar, A/D o ←/→ girar |
| **Chase** | Carrera hacia la salida de un mapa con obstáculos, contra una CPU que decide con Prolog (4 dificultades) o contra otra persona en el mismo teclado | J1: WASD · J2: flechas |

> **Racing: cuándo aparecen sus estadísticas.** En `racing` las estadísticas llegan a GameStats
> solo cuando la carrera termina, y eso pasa de dos maneras: **por jugadores**, cuando todos los
> autos (el usuario y los tres bots) completan las 3 vueltas, o **por tiempo**, 30 segundos después
> de que llega el primero; quien no alcanzó a terminar queda como no finalizado. Mientras la
> carrera sigue en curso, el panel ya cuenta la instancia, pero vueltas, choques y patrones
> aparecen hasta el final.

## 5. Los juegos y la orientación a objetos

Todos los juegos extienden la clase abstracta `Game` (`games/core/Game.ts`), que se encarga de lo
común: ciclo de vida (iniciar, actualizar, dibujar, terminar), el `matchId`, el teclado propio de
la partida y la emisión de eventos (`this.emit(tipo, datos, jugador)`). Cada juego solo implementa
sus reglas (`onStart`, `update`, `render`, `players`). La consola trabaja con `Game` y
`GameDefinition`, sin conocer ningún juego en particular; agregar uno es agregar una definición al
catálogo (`console/GameCatalog.ts`). El contrato completo está en
[`contextos/07-contrato-juegos.md`](contextos/07-contrato-juegos.md).

| Concepto | Ejemplo en el código |
|---|---|
| **Abstracción** | `Game` (partida), `Car` (auto), `Fighter` (luchador), `RouteFinder` (buscador de rutas) |
| **Herencia y polimorfismo** | `PlayerCar` / `BotCar` extienden `Car`; `PlayerFighter` / `BotFighter` extienden `Fighter`; `Racer`, `HumanRacer`, `CpuRacer` en chase. La partida trata a todos igual |
| **Encapsulación** | El estado de una partida (`Race`, `CombatMatch`, `ChaseMatch`) solo cambia por sus métodos; las reglas no dependen del dibujo ni del teclado |
| **Composición** | `ChaseGame` usa `ChaseMatch` + `ChaseRenderer` + `PrologRouteFinder`; `LapTracker`, `Track`, `Weapon`, `Arena`, `Board` son objetos con una sola responsabilidad |
| **Inyección de dependencias** | Chase recibe un `RouteFinder`: en el juego es Prolog; en las pruebas, uno falso |

Reglas, decisiones y clases de cada juego: [`contextos/02-decisiones.md`](contextos/02-decisiones.md)
y [`contextos/08-chase.md`](contextos/08-chase.md).

## 6. Inteligencia en Prolog

La CPU de **chase** no elige al azar: en cada jugada calcula la **ruta más corta con A\*** escrita
en Prolog (`ai-prolog/route.pl`).

- El juego envía a `POST /api/prolog/route` el tablero completo: tamaño, obstáculos, posición
  actual y meta. El servicio **no guarda estado** entre llamadas, por eso varias partidas
  simultáneas no se pueden mezclar.
- Prolog responde `{found, steps, turns, path}`. La CPU avanza por el primer paso de `path`; si
  `found` es falso (tablero sin ruta), el juego lo maneja.
- Si Prolog no responde, el juego reintenta y muestra un aviso en vez de congelarse.
- Las pruebas de `route.pl` (`test_route.pl`) incluyen comparar el A\* contra una búsqueda por
  fuerza bruta en tableros aleatorios.

Ejemplo, con el sistema levantado:

```bash
curl -s localhost:8082/route -H 'Content-Type: application/json' -d \
 '{"rows":3,"cols":3,"obstacles":[],"from":{"row":0,"col":0},"goal":{"row":2,"col":2}}'
```

Contrato completo: [`contextos/05-prolog.md`](contextos/05-prolog.md). Se eligió **SWI-Prolog** por
su imagen oficial de Docker y sus librerías HTTP y JSON incluidas.

## 7. Eventos y envío concurrente a GameStats

Los juegos no arman JSON a mano: llaman a `this.emit(...)` y la clase base `Game` completa los
campos exigidos por el contrato de GameStats (`docs/CONTRACT.md`):

| Campo | Cómo se arma |
|---|---|
| `matchId` | `<gameId>-<uuid>`: único por partida y siempre del mismo juego |
| `eventId` | `<matchId>-<número>`: único; el mismo evento reintentado conserva el mismo id |
| `timestamp` | UTC, `new Date().toISOString()` |
| `gameId`, `gameVersion`, `type`, `playerId`, `data` | según el juego; `MATCH_STARTED` y `MATCH_FINISHED` no llevan `playerId` |

Cada partida emite `MATCH_STARTED` al comenzar y `MATCH_FINISHED` al terminar (con eso GameStats
cuenta instancias y cierra la partida), más los eventos propios del juego (`LAP_COMPLETED`,
`SHOT_FIRED`, `ROUTE_COMPUTED`, `PLAYER_MOVED`, …). Eventos de cada juego:
[`contextos/04-eventos.md`](contextos/04-eventos.md).

**Estrategia de envío concurrente** (`events/HttpEventSink.ts`):

- Las partidas **nunca esperan al envío**: `emit` solo agrega a una cola en memoria y el juego sigue.
- Un solo envío en segundo plano junta los eventos de **todas** las partidas de la pestaña y los manda
  por lotes cada 250 ms en un arreglo JSON a `POST /api/ingest/events`, en el orden en que se emitieron.
- Cada evento lleva su `gameId` y `matchId`, así que los lotes mezclados se separan correctamente en
  GameStats. Varias pestañas son varios navegadores independientes que envían al mismo ingest; sus
  `matchId` no chocan porque llevan un uuid.
- **Fallos:** sin respuesta, `5xx`, `408` o `429` → se reintenta el mismo lote con espera creciente
  (0,5 s hasta 8 s). Como el `eventId` no cambia, GameStats descarta duplicados y reintentar es
  seguro. Otro `4xx` se descarta (repetirlo daría lo mismo).
- Al **cerrar la pestaña** se envía lo pendiente con peticiones `keepalive`.
- Del lado de GameStats, cada partida va siempre al mismo trabajador (Go), que es su único dueño: sin
  candados y sin mezclar partidas.

## 8. Panel de estadísticas

El panel (`console-web/src/dashboard/`) **consulta a GameStats cada 2 s y solo presenta**: no
calcula ninguna métrica.

| Se muestra | Viene de |
|---|---|
| Estadísticas **por juego** (partidas analizadas, jugadores, duración, patrones, contadores propios de cada juego) | `GET /results/games` (Scala) |
| Estadísticas **generales** (totales de todos los juegos) | `GET /results/games` → `total` |
| **Instancias ejecutadas** por juego y en total, y partidas en curso ahora | `GET /status` → `pipeline.games` y `openMatches` (Go) |

Las instancias suben **al abrir** la partida, sin esperar a que termine. Las estadísticas de
análisis (Scala) aparecen cuando la partida termina o se cierra por inactividad: GameStats analiza
partidas completas. Los resultados viven en memoria de GameStats; al reiniciarlo se pierden.
Por eso las estadísticas de `racing` (vueltas, choques, patrones) aparecen hasta que termina la
carrera, por jugadores o por tiempo (ver sección 4); las de `combat` y `chase`, al terminar su partida.

## 9. Desarrollo y pruebas

Requiere **Node 22**. Los servicios se levantan con Docker y la consola con Vite (recarga al guardar
y reenvía `/api/...` igual que nginx):

```bash
docker compose up -d analyzer ingest prolog
cd console-web
npm install
npm run dev          # http://localhost:5173
```

En desarrollo aparece además un juego de **Ejemplo** que no forma parte de la entrega (que lleva
exactamente tres juegos); en Docker se ve con http://localhost:3000/?demo.

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | revisa los tipos (`tsc`) y genera `dist/` |
| `npm test` | pruebas de la consola, los juegos y el envío de eventos (Vitest) |
| `swipl -g run_tests -t halt test_route.pl` (en `ai-prolog/`) | pruebas del A\* |
| `scripts/smoke-test.sh` | prueba de humo del sistema completo |

Prolog sin Docker: `swipl server.pl` dentro de `ai-prolog/` (puerto 8082).

## 10. CI/CD y deployment

### Integración continua (`.github/workflows/ci.yml`)

En cada push y pull request:

1. **Consola**: `npm ci`, `npm test` y `npm run build`.
2. **Prolog**: pruebas de `route.pl`.
3. **Sistema completo**: `docker compose up -d --build --wait` y `scripts/smoke-test.sh`, es decir,
   compila las imágenes y prepara la ejecución integrada con GameStats.

### Entrega continua (`.github/workflows/release.yml`)

Al **publicar un release** en GitHub (por ejemplo `v1.0`):

1. Vuelve a levantar el sistema y corre la prueba de humo; si falla, no se publica nada.
2. Publica `gameconsole-web` y `gameconsole-prolog` en **ghcr.io**, etiquetadas con la versión y `latest`.
3. Adjunta al release `gameconsole-images.tar.gz` con las cuatro imágenes, para cargarlas sin registro.

No hay secretos que configurar: usa el `GITHUB_TOKEN` temporal de GitHub.

**Para sacar una versión:** GitHub → Releases → *Draft a new release* → crear el tag (por ejemplo
`v1.0`) → *Publish release*. Después, **una sola vez**, en GitHub → Packages, abrir cada imagen →
*Package settings* → *Change visibility* → **Public**, para que se puedan descargar sin iniciar sesión.

### Deployment

El entorno definido por el equipo es **cualquier máquina con Docker y Compose v2** (la nuestra, un
servidor o una VM). El deployment es:

```bash
git clone <url-del-repo> && cd GameConsole
GAMECONSOLE_VERSION=v1.0 docker compose pull
GAMECONSOLE_VERSION=v1.0 docker compose up -d --no-build
docker compose ps        # los 4 servicios: healthy
```

| Tarea | Comando |
|---|---|
| Actualizar a otra versión | repetir con el nuevo `GAMECONSOLE_VERSION` (y `GAMESTATS_VERSION` si cambió) |
| Volver a una versión anterior | lo mismo con la versión anterior |
| Ver logs | `docker compose logs -f console` (o `ingest`, `analyzer`, `prolog`) |
| Entregar sin registro | `docker load -i gameconsole-images.tar.gz` y `docker compose up -d --no-build` |

Si se expone a Internet, cambiar `CONSOLE_PORT` (o poner delante un proxy con HTTPS); los puertos
8080–8082 solo hace falta publicarlos para depurar.

## 11. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Juegos | `combat`, `racing` y `chase` | Ya tienen analizador propio en GameStats; un juego nuevo solo tendría el genérico |
| Dónde corren | En el navegador, en TypeScript con clases | Cada pestaña es independiente, así que las partidas en paralelo casi no cuestan |
| Dibujo | Canvas 2D, sin framework | Sin dependencias nuevas |
| Servidor de la consola | nginx: página + proxy `/api/...` | GameStats no tiene CORS; no hay código de servidor propio |
| Prolog | SWI-Prolog en su contenedor, HTTP, sin estado | El enunciado pide contenerizar el intérprete; sin estado evita mezclar partidas |
| Mecánica de `chase` | Carrera contra una CPU guiada por Prolog | Cumple «usuario contra computadora»; el analizador de GameStats ya calcula por jugador |
| Aleatoriedad | `Random` con semilla en vez de `Math.random()` | Una partida se puede repetir igual, y así se prueba |
| GameStats | Se usa como imágenes publicadas, no se compila aquí | Es una plataforma externa; así se mantiene su separación de responsabilidades |
| GameStats v1.1 | Se agregó `pipeline.games` (Go) y `GET /results/games` (Scala) | La consola no puede calcular las instancias ni el resumen por juego; el enunciado permite extender GameStats para consultarlos |
| Timeout de inactividad | `IDLE_TIMEOUT=5m` (GameStats trae 30 s) | Una persona puede quedarse quieta; con 30 s se descartarían sus eventos como tardíos. Una partida abandonada tarda 5 min en aparecer en los resultados |
| Identificadores | `matchId=<gameId>-<uuid>`, `eventId=<matchId>-<n>` | Únicos, legibles y sin colisiones entre pestañas |
| Idioma | Identificadores en inglés; comentarios, textos y documentación en español | Igual que en GameStats |

Los acuerdos completos y las alternativas descartadas están en [`contextos/`](contextos/README.md).

## 12. Limitaciones conocidas

- Chase humano contra humano es **local** (mismo teclado); no hay servidor de partidas.
- La CPU de chase nunca choca: Prolog le da rutas libres.
- Los resultados viven en memoria de GameStats: al reiniciarlo se pierden.
- Una pestaña cerrada a mitad de partida deja la partida abierta hasta que vence `IDLE_TIMEOUT`.
- Las imágenes de GameStats son `linux/amd64`; en Mac con chip Apple corren emuladas (Docker avisa; es normal).
- `scripts/*.sh` son de bash: en Windows usar Git Bash o WSL.
- Las estadísticas de una partida de `racing` no están disponibles hasta que la carrera termina; si se abandona, hasta que vence `IDLE_TIMEOUT` (5 min).
## 13. Estructura del repositorio

```
GameConsole/
├── docker-compose.yml          sistema completo (consola, Prolog y GameStats)
├── scripts/
│   ├── smoke-test.sh           prueba de humo del sistema completo
│   └── export-images.sh        empaqueta las 4 imágenes en un .tar.gz
├── contextos/                  acuerdos del proyecto: decisiones, eventos, contrato de juegos
├── console-web/                la consola (TypeScript + Vite) servida por nginx
│   ├── Dockerfile · nginx.conf · vite.config.ts
│   └── src/
│       ├── console/            pantalla principal: catálogo, partidas abiertas, jugador
│       ├── games/              core/ (clase Game) · combat/ · racing/ · chase/ · example/ (solo desarrollo)
│       ├── events/             eventos por partida (MatchEvents) y su envío a GameStats (HttpEventSink)
│       ├── dashboard/          panel de estadísticas (consulta GameStats cada 2 s)
│       └── services/           estado de los servicios
├── ai-prolog/                  servicio Prolog: server.pl (HTTP), route.pl (A*), test_route.pl
└── .github/workflows/          ci.yml (pruebas y prueba de humo) · release.yml (imágenes y paquete)
```
