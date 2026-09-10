#!/usr/bin/env bash
# Materialize the *dbt* GCP service-account key from secret ENV VARS into a
# gitignored file, and print that file's path on stdout.
#
# SEPARATE from Meltano: do NOT read GCP_SA_KEY (that is vm-pulse-meltano).
# This script only accepts GCP_SA_KEY_DBT / GCP_SA_KEY_DBT_BASE64.
#
# NEVER commit the key and NEVER echo its contents.
#
# Accepted inputs (in priority order):
#   GCP_SA_KEY_DBT         the FULL vm-pulse-dbt key JSON (preferred), OR just
#                          the PEM private key (then GCP_SA_DBT_CLIENT_EMAIL
#                          or BIGQUERY_PROJECT is required).
#   GCP_SA_KEY_DBT_BASE64  base64 of the full JSON.
#
# When GCP_SA_KEY_DBT holds only a PEM private key, the JSON is reconstructed
# from:
#   GCP_SA_DBT_CLIENT_EMAIL   (optional if BIGQUERY_PROJECT is set — documented
#                              SA vm-pulse-dbt@<project>.iam.gserviceaccount.com)
#   BIGQUERY_PROJECT / GCP_PROJECT
#   GCP_SA_DBT_PRIVATE_KEY_ID (optional)
#
# Optional:
#   SA_KEY_PATH        destination (default: <transform>/.secrets/vm-pulse-dbt.json)
set -euo pipefail

transform_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="${SA_KEY_PATH:-$transform_dir/.secrets/vm-pulse-dbt.json}"
mkdir -p "$(dirname "$dest")"

# Refuse to accidentally consume the Meltano secret.
if [ -z "${GCP_SA_KEY_DBT:-}" ] && [ -z "${GCP_SA_KEY_DBT_BASE64:-}" ]; then
  if [ -n "${GCP_SA_KEY:-}" ] || [ -n "${GCP_SA_KEY_BASE64:-}" ]; then
    echo "[sa-key-dbt] ERROR: found Meltano GCP_SA_KEY / GCP_SA_KEY_BASE64 but not GCP_SA_KEY_DBT." >&2
    echo "  dbt uses a different SA (vm-pulse-dbt). Set GCP_SA_KEY_DBT (full JSON) like Meltano's GCP_SA_KEY." >&2
    exit 1
  fi
fi

SA_KEY_DEST="$dest" python3 <<'PY'
import base64, json, os, sys

dest = os.environ["SA_KEY_DEST"]
raw = os.environ.get("GCP_SA_KEY_DBT", "")
if not raw and os.environ.get("GCP_SA_KEY_DBT_BASE64"):
    raw = base64.b64decode(os.environ["GCP_SA_KEY_DBT_BASE64"]).decode()
raw = raw.strip()

if not raw:
    sys.exit(
        "[sa-key-dbt] ERROR: set GCP_SA_KEY_DBT (full JSON or PEM) or GCP_SA_KEY_DBT_BASE64. "
        "Do not pass Meltano GCP_SA_KEY here."
    )

info = None
if raw.startswith("{"):
    try:
        info = json.loads(raw)
    except Exception as e:
        sys.exit(f"[sa-key-dbt] ERROR: GCP_SA_KEY_DBT looks like JSON but did not parse: {e}")
elif "BEGIN" in raw and "PRIVATE KEY" in raw:
    client_email = os.environ.get("GCP_SA_DBT_CLIENT_EMAIL", "").strip()
    project = os.environ.get("BIGQUERY_PROJECT") or os.environ.get("GCP_PROJECT") or ""
    project = project.strip()
    if not client_email and project:
        client_email = f"vm-pulse-dbt@{project}.iam.gserviceaccount.com"
        sys.stderr.write(
            "[sa-key-dbt] GCP_SA_DBT_CLIENT_EMAIL unset; using documented SA "
            "vm-pulse-dbt@<project>.iam.gserviceaccount.com\n"
        )
    if not client_email:
        sys.exit(
            "[sa-key-dbt] ERROR: GCP_SA_KEY_DBT contains only a PRIVATE KEY, not the full "
            "service-account JSON.\n"
            "  Fix ONE of:\n"
            "  (A, preferred) set GCP_SA_KEY_DBT to the ENTIRE contents of the downloaded .json key file; or\n"
            "  (B) also set GCP_SA_DBT_CLIENT_EMAIL (e.g. vm-pulse-dbt@<project-id>.iam.gserviceaccount.com) "
            "so this script can reconstruct the JSON.\n"
            "  (C) set BIGQUERY_PROJECT and this script derives the documented SA email."
        )
    private_key = raw.replace("\\n", "\n") if ("\\n" in raw and "\n" not in raw) else raw
    info = {
        "type": "service_account",
        "private_key": private_key,
        "client_email": client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    if project:
        info["project_id"] = project
    pkid = os.environ.get("GCP_SA_DBT_PRIVATE_KEY_ID", "").strip()
    if pkid:
        info["private_key_id"] = pkid
else:
    sys.exit("[sa-key-dbt] ERROR: GCP_SA_KEY_DBT is neither a JSON object nor a PEM private key.")

for field in ("type", "client_email", "private_key"):
    if not info.get(field):
        sys.exit(f"[sa-key-dbt] ERROR: key is missing required field '{field}'.")
if info.get("type") != "service_account":
    sys.exit("[sa-key-dbt] ERROR: key 'type' is not 'service_account'.")
if "meltano" in str(info.get("client_email", "")).lower():
    sys.exit(
        "[sa-key-dbt] ERROR: this key is for a Meltano SA (client_email contains 'meltano'). "
        "dbt needs vm-pulse-dbt. Create a separate key; do not reuse GCP_SA_KEY."
    )

with open(dest, "w") as f:
    json.dump(info, f)
os.chmod(dest, 0o600)
sys.stderr.write(
    f"[sa-key-dbt] wrote valid service_account key for {info['client_email']} "
    f"(project {info.get('project_id', '?')}) -> {dest}\n"
)
PY

echo "$dest"
