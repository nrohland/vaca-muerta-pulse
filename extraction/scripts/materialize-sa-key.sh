#!/usr/bin/env bash
# Materialize a GCP service-account key from a secret ENV VAR into a gitignored
# file, and print that file's path on stdout. Used by both GitHub Actions and
# local/Cloud-Agent runs so the key never lives in git.
#
# NEVER commit the key and NEVER echo its contents.
#
# Input (provide exactly one):
#   GCP_SA_KEY         raw JSON content of the service-account key
#   GCP_SA_KEY_BASE64  base64-encoded JSON (handy for secret stores that mangle newlines)
#
# Optional:
#   SA_KEY_PATH        destination path (default: <extraction>/.secrets/meltano-raw-writer.json)
#
# Output:
#   writes the JSON to SA_KEY_PATH (chmod 600) and prints the path.
set -euo pipefail

extraction_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="${SA_KEY_PATH:-$extraction_dir/.secrets/meltano-raw-writer.json}"
mkdir -p "$(dirname "$dest")"

if [ -n "${GCP_SA_KEY_BASE64:-}" ]; then
  printf '%s' "$GCP_SA_KEY_BASE64" | base64 -d > "$dest"
elif [ -n "${GCP_SA_KEY:-}" ]; then
  printf '%s' "$GCP_SA_KEY" > "$dest"
else
  echo "ERROR: set GCP_SA_KEY (raw JSON) or GCP_SA_KEY_BASE64 (base64)." >&2
  exit 2
fi

chmod 600 "$dest"

# Validate structure WITHOUT printing key material.
python3 - "$dest" >&2 <<'PY'
import json, sys
path = sys.argv[1]
try:
    data = json.load(open(path))
except Exception as e:
    print(f"[sa-key] ERROR: {path} is not valid JSON ({e})", file=sys.stderr)
    sys.exit(3)
if data.get("type") != "service_account":
    print("[sa-key] ERROR: key 'type' is not 'service_account'", file=sys.stderr)
    sys.exit(3)
for field in ("client_email", "private_key", "project_id"):
    if not data.get(field):
        print(f"[sa-key] ERROR: missing field '{field}'", file=sys.stderr)
        sys.exit(3)
print(f"[sa-key] wrote valid service_account key for {data['client_email']} "
      f"(project {data['project_id']}) -> {path}", file=sys.stderr)
PY

echo "$dest"
