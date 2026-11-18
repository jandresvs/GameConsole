# 05 · Servicio Prolog

**Estado: implementado** (`ai-prolog/route.pl` + `server.pl`, pruebas en `test_route.pl`).
El contrato de abajo es el que cumple el servicio.

Esto es una **propuesta** para que el juego y el servicio se puedan escribir en
paralelo. Quien implemente el servicio puede ajustarla; si cambia, se actualiza
este archivo.

## Idea

Un servicio sin estado. El juego manda el tablero completo y dos celdas; Prolog
responde con la ruta más corta. Al no guardar nada entre llamadas, varias
partidas simultáneas no se pueden mezclar.

El servicio corre en `ai-prolog/server.pl` (SWI-Prolog, puerto 8082). Desde el
navegador se llama a través del proxy: `/api/prolog/...`.

## `GET /health`

Ya existe. Responde `200 {"status":"ok"}`.

## `POST /route`

**Petición**

```json
{
  "rows": 7,
  "cols": 14,
  "obstacles": [ { "row": 1, "col": 3 }, { "row": 2, "col": 8 } ],
  "from": { "row": 0, "col": 7 },
  "goal": { "row": 3, "col": 11 }
}
```

**Respuesta cuando hay ruta**

```json
{
  "found": true,
  "steps": 7,
  "turns": 1,
  "path": [
    { "row": 1, "col": 7, "direction": "abajo" },
    { "row": 2, "col": 7, "direction": "abajo" }
  ]
}
```

- `path` no incluye la celda de origen; el primer elemento es la siguiente jugada.
- `steps` es el largo de `path`. `turns` es cuántas veces cambia la dirección.
- `direction` usa los nombres del contrato: `arriba`, `abajo`, `izquierda`, `derecha`.

**Respuesta cuando no hay ruta:** `200 {"found": false}`.

**Petición inválida:** `400 {"error": "..."}` (JSON roto, celda fuera del tablero, origen sobre un obstáculo).

## Cómo lo usa `chase`

1. Al empezar, una llamada por jugador (usuario y CPU) para emitir sus `ROUTE_COMPUTED`.
2. En cada turno de la CPU, una llamada desde su celda actual; la CPU ejecuta `path[0]`.
3. Si Prolog no responde, el juego reintenta y avisa en pantalla. **Nunca** se
   reemplaza la decisión por un movimiento al azar.

## Requisitos

- Coordenadas `(row, col)` desde 0.
- Algoritmo: A\* con distancia Manhattan, cuatro direcciones, sin diagonales.
- Entre rutas igual de cortas, se devuelve una con el **mínimo de giros posible**.
  Criterio: el costo de un camino es (pasos, giros) comparado en ese orden, y el
  estado de la búsqueda es (celda, dirección de llegada), por eso el desempate es
  exacto y no una heurística. Un giro es cambiar de dirección respecto al paso
  anterior; el primer paso no cuenta.
- `goal` sobre un obstáculo responde `found: false` (no es un error 400).
- `from == goal` responde `found: true, steps: 0, path: []`.
- Límite: `rows` y `cols` entre 1 y 200.
- Hay que poder explicar el algoritmo en el video.

## Probar

```bash
cd ai-prolog
swipl server.pl
curl http://localhost:8082/health
```

Con Docker: `docker compose up -d --build prolog`.

```bash
curl -s -XPOST localhost:8082/route -H 'content-type: application/json' \
  -d '{"rows":7,"cols":14,"obstacles":[{"row":1,"col":3}],"from":{"row":0,"col":7},"goal":{"row":3,"col":11}}'
```

Pruebas (también corren en el CI):

```bash
cd ai-prolog
swipl -g run_tests -t halt test_route.pl
```

Incluyen una comparación contra búsqueda por fuerza bruta en 150 tableros
aleatorios: mismos pasos y mismo mínimo de giros.

## Cómo explicarlo en el video

- `route.pl` es A\*: la lista abierta es un heap ordenado por `f = pasos + Manhattan`
  (y luego giros). Manhattan nunca sobrestima en una cuadrícula de 4 direcciones,
  así que la primera vez que sale la meta del heap la ruta es óptima.
- Los vecinos se generan con el hecho `dir/3` y se filtran por rango y obstáculo.
- No hay `assert`: todo el estado va en argumentos, por eso peticiones simultáneas
  no se mezclan.

El archivo empieza con `:- encoding(utf8).` porque tiene tildes; debe seguir
siendo la primera línea.
