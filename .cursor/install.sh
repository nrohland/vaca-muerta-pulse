#!/usr/bin/env bash
# Vaca Muerta Pulse — Cloud Agent install (Hito 0).
#
# This repo is spec-driven and docs-only today: extraction/ (Meltano),
# transform/ (dbt) and apps/web/ (Next.js) are intentionally empty placeholders
# (see AGENTS.md), so there are no application dependencies to install yet.
#
# What we DO provision is the documentation-QA toolchain, so that
# `scripts/check-docs.sh` can fully validate the artifacts the Definition of
# Done cares about (AGENTS.md §5): Mermaid diagrams, relative links and tables.
#
# When Milestones 1-3 land their code, extend this script (e.g. Meltano/dbt
# Python deps, `npm ci` in apps/web) alongside the milestone that introduces
# them — do not scaffold them ahead of time.
set -euo pipefail

# Install user-global npm CLIs into a writable prefix (the default global
# prefix is not writable in this image).
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
mkdir -p "$NPM_CONFIG_PREFIX/bin"

# Render Mermaid with the image's system Chrome instead of downloading a
# bundled Chromium.
export PUPPETEER_SKIP_DOWNLOAD=true

MMDC="$NPM_CONFIG_PREFIX/bin/mmdc"
WANT_VER="11.17.0"

# Idempotent: (re)install only when missing or the pinned version differs.
have_ver="$("$MMDC" --version 2>/dev/null || true)"
if [ "$have_ver" != "$WANT_VER" ]; then
  echo "Installing @mermaid-js/mermaid-cli@${WANT_VER} into ${NPM_CONFIG_PREFIX} ..."
  npm install -g "@mermaid-js/mermaid-cli@${WANT_VER}"
else
  echo "mermaid-cli ${WANT_VER} already present; skipping."
fi

echo
echo "== docs-QA toolchain =="
echo "node  : $(node --version)"
echo "mmdc  : $("$MMDC" --version 2>/dev/null || echo MISSING)"
echo "chrome: $(command -v google-chrome-stable google-chrome chromium 2>/dev/null | head -1 || echo MISSING)"
echo
echo "Run documentation QA with: scripts/check-docs.sh"
