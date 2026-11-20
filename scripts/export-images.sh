#!/usr/bin/env bash
# Empaqueta las cuatro imágenes del sistema en un solo archivo, para entregarlo
# sin depender de ningún registro (ghcr.io).
#
#   scripts/export-images.sh                 → gameconsole-images.tar.gz
#
# Quien lo reciba hace:
#   docker load -i gameconsole-images.tar.gz     (o: gunzip -c ... | docker load)
#   docker compose up -d --no-build
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=${1:-gameconsole-images.tar.gz}

docker compose pull analyzer ingest      # imágenes publicadas de GameStats
docker compose build console prolog      # imágenes propias

# Los nombres exactos que usa el compose (respetan GAMESTATS_VERSION, etc.).
mapfile -t IMAGES < <(docker compose config --images | sort -u)
echo "Imágenes: ${IMAGES[*]}"

docker save "${IMAGES[@]}" | gzip > "$OUT"
echo "Listo: $OUT ($(du -h "$OUT" | cut -f1))"
