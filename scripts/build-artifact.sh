#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT_DIR/dist}"
ARTIFACT_NAME="${ARTIFACT_NAME:-guru-api-release.tar.gz}"
ARTIFACT_PATH="$DIST_DIR/$ARTIFACT_NAME"
STAGE_DIR="$DIST_DIR/.artifact-stage"
LAST_HASH_FILE="$DIST_DIR/.last-package-lock.sha"
FORCE_INCLUDE_NODE_MODULES="${FORCE_INCLUDE_NODE_MODULES:-0}"

echo "[build-artifact] Root: $ROOT_DIR"
echo "[build-artifact] Dist: $DIST_DIR"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
mkdir -p "$DIST_DIR"

cd "$ROOT_DIR"

CURRENT_HASH="$(shasum -a 256 package-lock.json | awk '{print $1}')"
PREV_HASH=""
if [ -f "$LAST_HASH_FILE" ]; then
  PREV_HASH="$(cat "$LAST_HASH_FILE")"
fi

INCLUDE_NODE_MODULES="0"
if [ "$FORCE_INCLUDE_NODE_MODULES" = "1" ] || [ ! -f "$LAST_HASH_FILE" ] || [ "$CURRENT_HASH" != "$PREV_HASH" ]; then
  INCLUDE_NODE_MODULES="1"
fi

if [ "$INCLUDE_NODE_MODULES" = "1" ]; then
  echo "[build-artifact] Dependencies changed (or forced). Including node_modules..."
  npm ci
  npm prune --omit=dev
else
  echo "[build-artifact] Dependencies unchanged. Skipping node_modules in artifact."
fi

echo "[build-artifact] Staging runtime files..."
cp -R app.js ecosystem.config.js package.json package-lock.json \
  config controllers errors middleware models routes services utils validators \
  "$STAGE_DIR/"

if [ -d "uploads" ]; then
  cp -R uploads "$STAGE_DIR/"
fi

if [ -f ".env.production" ]; then
  cp .env.production "$STAGE_DIR/.env.production"
fi

if [ "$INCLUDE_NODE_MODULES" = "1" ]; then
  cp -R node_modules "$STAGE_DIR/"
fi

echo "[build-artifact] Creating tarball..."
tar -C "$STAGE_DIR" -czf "$ARTIFACT_PATH" .
echo "$CURRENT_HASH" > "$LAST_HASH_FILE"

echo "[build-artifact] Artifact created: $ARTIFACT_PATH"
du -h "$ARTIFACT_PATH" | awk '{print "[build-artifact] Size: " $1}'
