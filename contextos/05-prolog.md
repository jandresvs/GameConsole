# 05 · Servicio Prolog (propuesta)

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
- Entre rutas igual de cortas, preferir la de menos giros (o documentar el criterio).
- Hay que poder explicar el algoritmo en el video.

## Probar

```bash
cd ai-prolog
swipl server.pl
curl http://localhost:8082/health
```

Con Docker: `docker compose up -d --build prolog`.

El archivo empieza con `:- encoding(utf8).` porque tiene tildes; debe seguir
siendo la primera línea.
