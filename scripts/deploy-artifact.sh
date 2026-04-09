#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT_DIR/dist}"
ARTIFACT_NAME="${ARTIFACT_NAME:-guru-api-release.tar.gz}"
ARTIFACT_PATH="$DIST_DIR/$ARTIFACT_NAME"

EC2_HOST="${EC2_HOST:-13.203.195.153}"
EC2_USER="${EC2_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-$HOME/Documents/development/stomap-app.pem}"
APP_DIR="${APP_DIR:-/var/www/exam-guruji/guru-api}"
PM2_APP_NAME="${PM2_APP_NAME:-guru-api}"

if [ ! -f "$ARTIFACT_PATH" ]; then
  echo "[deploy-artifact] Missing artifact: $ARTIFACT_PATH"
  echo "[deploy-artifact] Run: npm run build:artifact"
  exit 1
fi

echo "[deploy-artifact] Uploading $ARTIFACT_NAME to $EC2_USER@$EC2_HOST..."
scp -i "$SSH_KEY" "$ARTIFACT_PATH" "$EC2_USER@$EC2_HOST:/tmp/$ARTIFACT_NAME"

echo "[deploy-artifact] Extracting and restarting PM2..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
  set -euo pipefail
  mkdir -p '$APP_DIR'
  tar -xzf '/tmp/$ARTIFACT_NAME' -C '$APP_DIR'
  rm -f '/tmp/$ARTIFACT_NAME'
  cd '$APP_DIR'
  pm2 restart '$PM2_APP_NAME' --update-env || pm2 start ecosystem.config.js --env production
  pm2 save
  pm2 status '$PM2_APP_NAME'
"

echo "[deploy-artifact] Deployment complete."

