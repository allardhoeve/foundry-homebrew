#!/usr/bin/env bash
set -euo pipefail

# Push the mirrored "You see this." token art to the production Foundry.
#
# The tokens live in Foundry's Data directory, not inside the module, so that
# reinstalling the module cannot wipe them.  They are gitignored and never in
# module.zip, so nothing else ever puts them on the server: after a fresh
# download run, this script is what gets them there.
#
#   tools/boogers/sync_tokens.sh             # push anything new
#   tools/boogers/sync_tokens.sh --dry-run   # list what would be pushed
#
# Both ends serve the art at the same relative path, so a token picked in the
# dev world resolves in production too:
#
#   assets/tokens/youseethis/<name>.png

REL="assets/tokens/youseethis"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRETS_FILE="$REPO_ROOT/.deploy-secrets"
SRC="$REPO_ROOT/docker/data/Data/$REL"

DRY_RUN=()
case "${1:-}" in
  --dry-run) DRY_RUN=(-n) ;;
  "") ;;
  *) echo "Usage: $0 [--dry-run]" >&2; exit 2 ;;
esac

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Error: secrets file not found: $SECRETS_FILE" >&2
  echo "Create it with DEPLOY_USER, DEPLOY_HOST, and DEPLOY_DATA." >&2
  exit 1
fi

source "$SECRETS_FILE"

if [[ -z "${DEPLOY_USER:-}" || -z "${DEPLOY_HOST:-}" || -z "${DEPLOY_DATA:-}" ]]; then
  echo "Error: .deploy-secrets must define DEPLOY_USER, DEPLOY_HOST, and DEPLOY_DATA." >&2
  echo "DEPLOY_DATA is Foundry's Data directory on the server, e.g. /data/foundry/Data" >&2
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "Error: $SRC does not exist." >&2
  echo "Run: cd tools/boogers && uv run python download_tokens.py" >&2
  exit 1
fi

COUNT=$(find "$SRC" -name '*.png' | wc -l | tr -d ' ')
DEST="${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DATA}/${REL}/"

echo "Syncing $COUNT tokens to $DEST"

# rsync will create the leaf directory but not its parents, and assets/tokens/
# may not exist on a server that has never had these.
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p '${DEPLOY_DATA}/${REL}'"

# Half-finished downloads are left as .part files by download_tokens.py and
# must never reach the server.  The ${X[@]+...} form is for macOS bash 3.2,
# where an empty array under set -u counts as unbound.
rsync -aiz ${DRY_RUN[@]+"${DRY_RUN[@]}"} --exclude '*.part' "$SRC/" "$DEST"
