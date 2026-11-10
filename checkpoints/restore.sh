#!/usr/bin/env bash
# Rollback helper — Cloud Server
# Pakai:  bash checkpoints/restore.sh <nama-checkpoint>
# Contoh: bash checkpoints/restore.sh rev10-pre-psychology-20261110-1245

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${1:-}"

if [ -z "$NAME" ]; then
  echo "Checkpoint tersedia:"
  ls -1 "$ROOT/checkpoints" | grep -v restore.sh | grep -v README.md
  exit 1
fi

SNAP="$ROOT/checkpoints/$NAME"
if [ ! -d "$SNAP" ]; then
  echo "Checkpoint tidak ditemukan: $NAME" >&2
  exit 1
fi

echo "⚠️  Restore checkpoint: $NAME"
cp "$SNAP/index.html" "$ROOT/index.html"
cp "$SNAP/css/styles.css" "$ROOT/css/styles.css"
cp "$SNAP/js/main.js" "$ROOT/js/main.js"
cp "$SNAP/JOURNAL.md" "$ROOT/JOURNAL.md"
cp "$SNAP/docs/STATUS.md" "$ROOT/docs/STATUS.md"

echo "✅ File dipulihkan. Restart server: cd $ROOT && node server.js"
