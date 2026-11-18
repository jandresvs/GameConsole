# GameConsole

Consola web de videojuegos. Proyecto 2 del curso Lenguajes de Programación (TEC).

Tres juegos orientados a objetos (**combat**, **racing** y **chase**), partidas
en paralelo, una CPU que decide con **Prolog**, y estadísticas en vivo que vienen
de [GameStats](https://github.com/ssanscarlos-rgb/GameStats), el proyecto 1.

> **Estado: en construcción.** La consola abre partidas (varias a la vez o en
> otra pestaña) y envía sus eventos a GameStats. De los tres juegos, `racing`
> ya se puede jugar; faltan `combat`, `chase` y el panel. Los acuerdos del proyecto,
> el reparto y lo que sigue están en [`contextos/`](contextos/README.md).

```
 navegador ──► console (nginx :3000) ──/api/ingest──► ingest   (GameStats, Go)
               página + proxy        ──/api/analyzer► analyzer (GameStats, Scala)
                                     ──/api/prolog──► prolog   (SWI-Prolog)
```

## Ejecutar

Requisitos: **Docker** con **Compose v2** y los puertos **3000, 8080, 8081 y 8082** libres.
No hace falta tener Node ni Prolog instalados.

```bash
git clone <url-del-repo>
cd GameConsole
docker compose up -d --build
docker compose ps
```

Los cuatro servicios deben decir `healthy`. Luego abrir **http://localhost:3000**.

- La sección **Servicios** debe mostrar los tres "en línea".
- La sección **Envío de eventos** muestra cuántos eventos aceptó GameStats y si
  hay algo en cola o reintentándose.

Apagar:

```bash
docker compose down
```

GameStats se descarga como imágenes publicadas (`ghcr.io/ssanscarlos-rgb/...`),
no se compila aquí. Como usa los puertos 8080 y 8081, no puede estar levantado a
la vez el compose del repo de GameStats.

| Variable | Por defecto | Para qué |
|---|---|---|
| `GAMESTATS_VERSION` | `v1.0` | versión de las imágenes de GameStats |
| `IDLE_TIMEOUT` | `5m` | tiempo sin eventos tras el que GameStats cierra una partida |
| `CONSOLE_PORT` | `3000` | puerto de la consola en la máquina |

El panel original de GameStats sirve para depurar (eventos rechazados, flujo de
eventos). Se levanta aparte y queda en http://localhost:8090:

```bash
docker compose --profile debug up -d
```

## Desarrollo

Requiere **Node 22**. Los servicios se levantan con Docker y la consola con
Vite, que recarga al guardar y reenvía `/api/...` igual que nginx:

```bash
docker compose up -d analyzer ingest prolog
cd console-web
npm install
npm run dev
```

La consola queda en http://localhost:5173. En desarrollo aparece además un
juego de **Ejemplo**, que no forma parte de la entrega; en la versión de Docker
se puede ver con http://localhost:3000/?demo

| Comando (dentro de `console-web/`) | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | revisa los tipos (`tsc`) y genera `dist/` |
| `npm test` | corre las pruebas automáticas |

El servicio Prolog se puede correr sin Docker con `swipl server.pl` dentro de
`ai-prolog/` (queda en el puerto 8082).

## Estructura

```
GameConsole/
├── docker-compose.yml     sistema completo
├── contextos/             acuerdos del proyecto: decisiones, eventos, reparto
├── console-web/           la consola: TypeScript + Vite, servida por nginx
├── ai-prolog/             servicio de inteligencia en SWI-Prolog
└── .github/workflows/     CI
```

El detalle de cada pieza está en [`contextos/03-arquitectura.md`](contextos/03-arquitectura.md).
