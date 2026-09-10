#!/usr/bin/env bash
# Vaca Muerta Pulse — Hito 0 documentation QA.
#
# This repo is spec-driven and docs-only today (extraction/, transform/,
# apps/web/ are intentionally empty placeholders). The "application" that can
# be run right now is the documentation itself. Per AGENTS.md §5 (Definition of
# Done), Mermaid diagrams and links/tables must stay valid before merge — this
# script checks exactly that.
#
# Usage:
#   scripts/check-docs.sh [ROOT_DIR]   # defaults to the repo root
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# Make a user-local mmdc install discoverable when present.
export PATH="$HOME/.npm-global/bin:$PATH"

echo "== Vaca Muerta Pulse · docs QA =="
echo "root: $ROOT"
echo "node: $(node --version 2>/dev/null || echo 'MISSING')"
echo

rc=0
node "$SCRIPT_DIR/docs-qa/lint.mjs" "$ROOT" || rc=1
echo
node "$SCRIPT_DIR/docs-qa/check-mermaid.mjs" "$ROOT" || rc=1
echo

if [ "$rc" -eq 0 ]; then
  echo "docs QA: PASS"
else
  echo "docs QA: FAIL"
fi
exit "$rc"
