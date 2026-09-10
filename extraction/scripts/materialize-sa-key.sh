#!/usr/bin/env bash
# Materialize a GCP service-account key from secret ENV VARS into a gitignored
# file, and print that file's path on stdout. Used by GitHub Actions and
# local/Cloud-Agent runs so the key never lives in git.
#
# NEVER commit the key and NEVER echo its contents.
#
# Accepted inputs (in priority order):
#   GCP_SA_KEY         the FULL service-account key JSON (preferred), OR just the
#                      PEM private key (then GCP_SA_CLIENT_EMAIL is required).
#   GCP_SA_KEY_BASE64  base64 of the full JSON (handy for stores that mangle newlines).
#
# When GCP_SA_KEY holds only a PEM private key, the JSON is reconstructed from:
#   GCP_SA_CLIENT_EMAIL   (required)  e.g. vm-pulse-meltano@<project-id>.iam.gserviceaccount.com
#   BIGQUERY_PROJECT / GCP_PROJECT    (optional; taken from env if present)
#   GCP_SA_PRIVATE_KEY_ID             (optional)
#
# Optional:
#   SA_KEY_PATH        destination (default: <extraction>/.secrets/vm-pulse-meltano.json)
set -euo pipefail

extraction_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="${SA_KEY_PATH:-$extraction_dir/.secrets/vm-pulse-meltano.json}"
mkdir -p "$(dirname "$dest")"

SA_KEY_DEST="$dest" python3 <<'PY'
import base64, json, os, sys

dest = os.environ["SA_KEY_DEST"]
raw = os.environ.get("GCP_SA_KEY", "")
if not raw and os.environ.get("GCP_SA_KEY_BASE64"):
    raw = base64.b64decode(os.environ["GCP_SA_KEY_BASE64"]).decode()
raw = raw.strip()

if not raw:
    sys.exit("[sa-key] ERROR: set GCP_SA_KEY (full JSON or PEM) or GCP_SA_KEY_BASE64.")

info = None
if raw.startswith("{"):
    try:
        info = json.loads(raw)
    except Exception as e:
        sys.exit(f"[sa-key] ERROR: GCP_SA_KEY looks like JSON but did not parse: {e}")
elif "BEGIN" in raw and "PRIVATE KEY" in raw:
    client_email = os.environ.get("GCP_SA_CLIENT_EMAIL", "").strip()
    if not client_email:
        sys.exit(
            "[sa-key] ERROR: GCP_SA_KEY contains only a PRIVATE KEY, not the full "
            "service-account JSON.\n"
            "  Fix ONE of:\n"
            "  (A, preferred) set GCP_SA_KEY to the ENTIRE contents of the downloaded .json key file; or\n"
            "  (B) also set GCP_SA_CLIENT_EMAIL (e.g. vm-pulse-meltano@<project-id>.iam.gserviceaccount.com) "
            "so this script can reconstruct the JSON."
        )
    private_key = raw.replace("\\n", "\n") if ("\\n" in raw and "\n" not in raw) else raw
    info = {
        "type": "service_account",
        "private_key": private_key,
        "client_email": client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    project = os.environ.get("BIGQUERY_PROJECT") or os.environ.get("GCP_PROJECT")
    if project:
        info["project_id"] = project
    pkid = os.environ.get("GCP_SA_PRIVATE_KEY_ID", "").strip()
    if pkid:
        info["private_key_id"] = pkid
else:
    sys.exit("[sa-key] ERROR: GCP_SA_KEY is neither a JSON object nor a PEM private key.")

for field in ("type", "client_email", "private_key"):
    if not info.get(field):
        sys.exit(f"[sa-key] ERROR: key is missing required field '{field}'.")
if info.get("type") != "service_account":
    sys.exit("[sa-key] ERROR: key 'type' is not 'service_account'.")

with open(dest, "w") as f:
    json.dump(info, f)
os.chmod(dest, 0o600)
sys.stderr.write(
    f"[sa-key] wrote valid service_account key for {info['client_email']} "
    f"(project {info.get('project_id', '?')}) -> {dest}\n"
)
PY

echo "$dest"
