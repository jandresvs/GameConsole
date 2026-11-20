#!/usr/bin/env bash
# Prueba de humo del sistema completo (consola + Prolog + GameStats).
#
# Responde: ¿las piezas se entienden entre ellas? Comprueba, a través del proxy
# de nginx igual que lo hace el navegador:
#   1. la consola y los tres servicios responden;
#   2. Prolog calcula una ruta y detecta un tablero sin ruta;
#   3. DOS partidas simultáneas de chase suben "opened" en GameStats mientras
#      siguen en curso (A6) y "delivered" cuando terminan;
#   4. ningún evento fue rechazado, y el analizador reporta el juego.
#
# Uso:   docker compose up -d --build --wait && scripts/smoke-test.sh
# Variables: BASE (por defecto http://localhost:3000). Requiere curl y jq.
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
INGEST=${INGEST:-$BASE/api/ingest}
ANALYZER=${ANALYZER:-$BASE/api/analyzer}
PROLOG=${PROLOG:-$BASE/api/prolog}
RUN="$(date +%s)-$RANDOM"

ok()   { echo "  ✔ $*"; }
fail() { echo "  ✘ $*" >&2; exit 1; }
get()  { curl -sf --max-time 10 "$1"; }
post() { curl -sf --max-time 10 -H 'Content-Type: application/json' -d "$2" "$1"; }
now()  { date -u +%Y-%m-%dT%H:%M:%S.000Z; }

# Comprueba una expresión jq sobre el texto JSON $2; si no se cumple, el script termina.
check() { # descripción json jq-expr
  jq -e "$3" >/dev/null <<<"$2" && ok "$1" || fail "$1"
}

# Espera (hasta ~30 s) a que una expresión jq sobre $1 sea verdadera.
wait_for() { # url jq-expr descripción
  for _ in $(seq 1 60); do
    get "$1" | jq -e "$2" >/dev/null 2>&1 && { ok "$3"; return 0; }
    sleep 0.5
  done
  fail "$3 (no se cumplió a tiempo)"
}

# Un evento de chase listo para enviar. Uso: ev <matchId> <n> <TIPO> [playerId] [data-json]
ev() {
  jq -nc --arg m "$1" --arg n "$2" --arg t "$3" --arg p "${4:-}" --arg d "${5:-}" --arg ts "$(now)" '
    {eventId: "\($m)-\($n)", timestamp: $ts, gameId: "chase", gameVersion: "1.0", matchId: $m, type: $t}
    + (if $p != "" then {playerId: $p} else {} end)
    + (if $d != "" then {data: ($d | fromjson)} else {} end)'
}

echo "1. Servicios"
get "$BASE/healthz"    >/dev/null && ok "consola (nginx)"          || fail "la consola no responde en $BASE"
get "$INGEST/health"   >/dev/null && ok "ingest (GameStats, Go)"   || fail "el ingest no responde"
get "$ANALYZER/health" >/dev/null && ok "analyzer (GameStats, Scala)" || fail "el analyzer no responde"
get "$PROLOG/health"   >/dev/null && ok "prolog"                   || fail "prolog no responde"

echo "2. Prolog"
free='{"rows":3,"cols":3,"obstacles":[],"from":{"row":0,"col":0},"goal":{"row":2,"col":2}}'
walled='{"rows":3,"cols":3,"obstacles":[{"row":1,"col":0},{"row":1,"col":1},{"row":1,"col":2}],"from":{"row":0,"col":0},"goal":{"row":2,"col":2}}'
check "ruta más corta en tablero libre (4 pasos)" "$(post "$PROLOG/route" "$free")"   '.found == true and .steps == 4'
check "tablero sin ruta: found=false"            "$(post "$PROLOG/route" "$walled")" '.found == false' 

echo "3. Dos partidas simultáneas (instancias por juego, A6)"
status=$(get "$INGEST/status")
opened0=$(jq '.pipeline.games.chase.opened // 0' <<<"$status")
delivered0=$(jq '.pipeline.games.chase.delivered // 0' <<<"$status")
rejected0=$(jq '.rejected' <<<"$status")
jq -e '.pipeline | has("games")' <<<"$status" >/dev/null \
  || fail "el ingest no trae pipeline.games: hace falta GameStats v1.1 o posterior"

A="chase-smoke-$RUN-a"; B="chase-smoke-$RUN-b"
start() { # matchId → MATCH_STARTED + ROUTE_COMPUTED
  post "$INGEST/events" "[$(ev "$1" 1 MATCH_STARTED),$(ev "$1" 2 ROUTE_COMPUTED humano '{"found":true,"optimalSteps":4,"routeTurns":1}')]" >/dev/null
}
start "$A" & start "$B" & wait   # las dos a la vez, como dos pestañas

wait_for "$INGEST/status" ".pipeline.games.chase.opened == $((opened0 + 2))" "opened sube en 2 con las partidas en curso"
check "delivered no cambia mientras siguen abiertas" "$(get "$INGEST/status")" ".pipeline.games.chase.delivered == $delivered0"

finish() { # matchId → TARGET_REACHED + MATCH_FINISHED
  post "$INGEST/events" "[$(ev "$1" 3 TARGET_REACHED humano '{"steps":4,"turns":1}'),$(ev "$1" 4 MATCH_FINISHED '' '{"winnerId":"humano"}')]" >/dev/null
}
finish "$A" & finish "$B" & wait

wait_for "$INGEST/status" ".pipeline.games.chase.delivered == $((delivered0 + 2))" "delivered sube en 2 al terminar"

echo "4. Resultados"
check "ningún evento rechazado ni envío fallido" "$(get "$INGEST/status")" ".rejected == $rejected0 and .pipeline.batchesFailed == 0"
wait_for "$ANALYZER/results/games" '[.games[] | select(.gameId=="chase")] | length == 1 and .[0].matchesAnalyzed >= 2' \
  "el analizador reporta chase con las 2 partidas"

echo "Prueba de humo superada."
