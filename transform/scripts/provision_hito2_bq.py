#!/usr/bin/env python3
"""Provision Hito 2 BigQuery datasets + the dbt service account.

Intended operator: Nicolás (project IAM admin / owner). The Meltano SA
(vm-pulse-meltano) can list datasets but cannot enable iam.googleapis.com
or create service accounts.

Never prints key material. Never writes a key unless --create-key PATH is set.

Env:
  BIGQUERY_PROJECT / GCP_PROJECT   (default: extraction/.env.example)
  BIGQUERY_LOCATION                (default: US)
  GOOGLE_APPLICATION_CREDENTIALS   user ADC or an admin SA (not Meltano)

Modes:
  --verify-only     read datasets + attempt SA lookup; no mutations
  (default)         ensure datasets, enable IAM API, create SA, grant roles
  --create-key PATH write a new JSON key to PATH (gitignored); chmod 600
  --unset-table-expiration
                    clear dataset default table expiration on dbt datasets
  --tighten-acl     remove vm-pulse-meltano from dbt dataset ACLs
  --dry-run         print planned mutations; do not apply
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from google.auth.transport.requests import Request
from google.cloud import bigquery
from google.cloud.bigquery.dataset import AccessEntry
from google.api_core.exceptions import Forbidden, NotFound
from google.oauth2 import service_account
import google.auth

REPO_ROOT = Path(__file__).resolve().parents[2]
DBT_DATASETS = ("stg_cap4_dev", "int_cap4_dev", "marts_cap4_dev")
RAW_DEV = "raw_cap4_dev"
RAW_PROD = "raw_cap4"
SA_ID = "vm-pulse-dbt"
MELTANO_SA_ID = "vm-pulse-meltano"
DBT_DATASET_DESCRIPTION = "Hito 2 dbt (dev). Created for AE; Meltano does not write here."
SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


def _default_project() -> str:
    env = (os.environ.get("BIGQUERY_PROJECT") or os.environ.get("GCP_PROJECT") or "").strip()
    if env:
        return env
    example = REPO_ROOT / "extraction" / ".env.example"
    if example.is_file():
        for line in example.read_text(encoding="utf-8").splitlines():
            if line.startswith("BIGQUERY_PROJECT="):
                return line.split("=", 1)[1].strip()
    return ""


def _creds():
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if path:
        return service_account.Credentials.from_service_account_file(path, scopes=SCOPES)
    creds, _ = google.auth.default(scopes=SCOPES)
    return creds


def _token(creds) -> str:
    if not creds.valid:
        creds.refresh(Request())
    if not creds.valid or not creds.token:
        creds.refresh(Request())
    return creds.token


def _rest(creds, method: str, url: str, body: dict | None = None) -> tuple[int, dict | str]:
    data = None
    headers = {"Authorization": f"Bearer {_token(creds)}"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = raw
        return e.code, parsed


def _error_message(payload: dict | str) -> str:
    if isinstance(payload, dict):
        err = payload.get("error") or {}
        msg = err.get("message") or str(payload)
        # Strip Google "Help Token" blobs — not useful in repo logs.
        if "Help Token:" in msg:
            msg = msg.split("Help Token:")[0].strip()
        return msg
    return str(payload)[:400]


def sa_email(project: str, account_id: str = SA_ID) -> str:
    return f"{account_id}@{project}.iam.gserviceaccount.com"


def describe_dataset(client: bigquery.Client, project: str, name: str) -> dict:
    ds_id = f"{project}.{name}"
    try:
        ds = client.get_dataset(ds_id)
    except NotFound:
        return {"name": name, "exists": False}
    except Forbidden as e:
        return {"name": name, "exists": None, "error": f"FORBIDDEN: {e.message}"}
    tables = [t.table_id for t in client.list_tables(ds)]
    expire_ms = ds.default_table_expiration_ms
    expire_days = round(expire_ms / 86400000, 2) if expire_ms else None
    access = []
    for entry in ds.access_entries:
        entity = (
            entry.entity_id
            or entry.user_by_email
            or entry.group_by_email
            or entry.special_group
            or "?"
        )
        access.append({"role": entry.role, "entity_type": entry.entity_type, "entity": entity})
    return {
        "name": name,
        "exists": True,
        "location": ds.location,
        "created": ds.created.isoformat() if ds.created else None,
        "modified": ds.modified.isoformat() if ds.modified else None,
        "description": ds.description,
        "default_table_expiration_days": expire_days,
        "tables": tables,
        "access": access,
    }


def print_dataset_report(info: dict) -> None:
    if not info.get("exists"):
        extra = f" ({info.get('error')})" if info.get("error") else ""
        print(f"MISSING {info['name']}{extra}")
        return
    tables = info["tables"] or ["(none)"]
    expire = info.get("default_table_expiration_days")
    expire_s = f"{expire}d" if expire is not None else "none"
    print(
        f"EXISTS {info['name']} location={info['location']} "
        f"created={info['created']} expiration={expire_s} tables={tables}"
    )
    if info.get("description"):
        print(f"  description: {info['description']}")
    for a in info.get("access", []):
        print(f"  acl {a['role']:6} {a['entity_type']} {a['entity']}")


def verify(client: bigquery.Client, creds, project: str) -> int:
    print(f"[verify] project={project} location={os.environ.get('BIGQUERY_LOCATION', 'US')}")
    wanted = (RAW_DEV, RAW_PROD, *DBT_DATASETS, "stg_cap4", "int_cap4", "marts_cap4")
    reports = {name: describe_dataset(client, project, name) for name in wanted}
    print("=== datasets ===")
    for name in wanted:
        print_dataset_report(reports[name])

    print("=== service account vm-pulse-dbt ===")
    status, payload = _rest(
        creds,
        "GET",
        f"https://iam.googleapis.com/v1/projects/{project}/serviceAccounts/{sa_email(project)}",
    )
    if status == 200 and isinstance(payload, dict):
        print(
            "EXISTS "
            f"email={payload.get('email')} disabled={payload.get('disabled')} "
            f"uniqueId={payload.get('uniqueId')}"
        )
        sa_state = "exists"
    elif status == 404:
        print("MISSING vm-pulse-dbt (404)")
        sa_state = "missing"
    else:
        print(f"BLOCKED HTTP {status}: {_error_message(payload)}")
        sa_state = "blocked"

    dbt_ok = all(reports[n].get("exists") is True for n in DBT_DATASETS)
    raw_dev_ok = reports[RAW_DEV].get("exists") is True
    raw_prod = reports[RAW_PROD].get("exists") is True
    print("=== summary ===")
    print(f"raw_cap4_dev={'yes' if raw_dev_ok else 'no'}  raw_cap4={'yes' if raw_prod else 'NO (expected)'}")
    print(f"stg/int/marts_cap4_dev={'yes' if dbt_ok else 'no'}")
    print(f"vm-pulse-dbt={sa_state}")
    if dbt_ok and raw_dev_ok and sa_state != "exists":
        print(
            "[verify] datasets OK. SA vm-pulse-dbt is NOT confirmed. "
            "Nicolás must run this script without --verify-only "
            "(enable IAM API + create SA + grants)."
        )
        return 2
    if not dbt_ok or not raw_dev_ok:
        print("[verify] required datasets missing.")
        return 1
    print("[verify] datasets + SA OK.")
    return 0


def ensure_dataset(
    client: bigquery.Client,
    project: str,
    name: str,
    location: str,
    dry_run: bool,
) -> None:
    ds_id = f"{project}.{name}"
    try:
        ds = client.get_dataset(ds_id)
        print(f"[dataset] exists {ds_id} location={ds.location}")
        if ds.description != DBT_DATASET_DESCRIPTION and not dry_run:
            ds.description = DBT_DATASET_DESCRIPTION
            client.update_dataset(ds, ["description"])
            print(f"[dataset] updated description on {ds_id}")
        return
    except NotFound:
        pass
    if dry_run:
        print(f"[dataset] DRY-RUN would create {ds_id} in {location}")
        return
    ref = bigquery.Dataset(ds_id)
    ref.location = location
    ref.description = DBT_DATASET_DESCRIPTION
    client.create_dataset(ref, exists_ok=True)
    print(f"[dataset] created {ds_id} in {location}")


def unset_expiration(client: bigquery.Client, project: str, name: str, dry_run: bool) -> None:
    ds = client.get_dataset(f"{project}.{name}")
    if not ds.default_table_expiration_ms:
        print(f"[expiration] {name} already unset")
        return
    days = round(ds.default_table_expiration_ms / 86400000, 2)
    if dry_run:
        print(f"[expiration] DRY-RUN would clear {days}d default on {name}")
        return
    ds.default_table_expiration_ms = None
    client.update_dataset(ds, ["default_table_expiration_ms"])
    print(f"[expiration] cleared {days}d default on {name}")


def _has_access(ds: bigquery.Dataset, email: str, role: str) -> bool:
    for e in ds.access_entries:
        entity = e.entity_id or e.user_by_email or ""
        if e.role == role and entity == email:
            return True
    return False


def grant_dataset_role(
    client: bigquery.Client,
    project: str,
    dataset: str,
    email: str,
    role: str,
    dry_run: bool,
) -> None:
    ds = client.get_dataset(f"{project}.{dataset}")
    if _has_access(ds, email, role):
        print(f"[acl] {dataset} already has {role} for {email}")
        return
    if dry_run:
        print(f"[acl] DRY-RUN would add {role} {email} on {dataset}")
        return
    entries = list(ds.access_entries)
    entries.append(AccessEntry(role=role, entity_type="userByEmail", entity_id=email))
    ds.access_entries = entries
    client.update_dataset(ds, ["access_entries"])
    print(f"[acl] granted {role} to {email} on {dataset}")


def tighten_acl(client: bigquery.Client, project: str, dry_run: bool) -> None:
    meltano = sa_email(project, MELTANO_SA_ID)
    for name in DBT_DATASETS:
        ds = client.get_dataset(f"{project}.{name}")
        kept = []
        removed = []
        for e in ds.access_entries:
            entity = e.entity_id or e.user_by_email or ""
            if entity == meltano:
                removed.append(e.role)
                continue
            kept.append(e)
        if not removed:
            print(f"[acl] {name} has no Meltano entries")
            continue
        if dry_run:
            print(f"[acl] DRY-RUN would drop Meltano {removed} from {name}")
            continue
        ds.access_entries = kept
        client.update_dataset(ds, ["access_entries"])
        print(f"[acl] removed Meltano {removed} from {name} (Meltano must not write dbt datasets)")


def enable_iam_api(creds, project: str, dry_run: bool) -> None:
    url = f"https://serviceusage.googleapis.com/v1/projects/{project}/services/iam.googleapis.com"
    status, payload = _rest(creds, "GET", url)
    if status == 200 and isinstance(payload, dict) and payload.get("state") == "ENABLED":
        print("[iam-api] iam.googleapis.com already ENABLED")
        return
    if dry_run:
        print("[iam-api] DRY-RUN would enable iam.googleapis.com")
        return
    status, payload = _rest(creds, "POST", f"{url}:enable", {})
    if status in (200, 201):
        print("[iam-api] enable request accepted")
        return
    raise SystemExit(
        f"[iam-api] ERROR HTTP {status}: {_error_message(payload)}\n"
        "  Nicolás: enable Identity and Access Management (IAM) API in the GCP console,\n"
        "  then re-run this script with owner/editor credentials (not vm-pulse-meltano)."
    )


def ensure_sa(creds, project: str, dry_run: bool) -> None:
    email = sa_email(project)
    url = f"https://iam.googleapis.com/v1/projects/{project}/serviceAccounts/{email}"
    status, payload = _rest(creds, "GET", url)
    if status == 200:
        print(f"[sa] exists {email}")
        return
    if status not in (403, 404):
        raise SystemExit(f"[sa] ERROR lookup HTTP {status}: {_error_message(payload)}")
    if status == 403:
        # API disabled or no iam.serviceAccounts.get
        print(f"[sa] lookup blocked HTTP 403: {_error_message(payload)}")
    if dry_run:
        print(f"[sa] DRY-RUN would create {email}")
        return
    create_url = f"https://iam.googleapis.com/v1/projects/{project}/serviceAccounts"
    status, payload = _rest(
        creds,
        "POST",
        create_url,
        {
            "accountId": SA_ID,
            "serviceAccount": {
                "displayName": "Vaca Muerta Pulse dbt",
                "description": "Hito 2: reads raw_cap4_dev, writes stg/int/marts_cap4_dev",
            },
        },
    )
    if status in (200, 201):
        print(f"[sa] created {email}")
        return
    raise SystemExit(
        f"[sa] ERROR create HTTP {status}: {_error_message(payload)}\n"
        "  The Meltano SA cannot create service accounts. Run as Nicolás:\n"
        f"    gcloud iam service-accounts create {SA_ID} --project={project} "
        '--display-name="Vaca Muerta Pulse dbt"'
    )


def grant_job_user(creds, project: str, dry_run: bool) -> None:
    member = f"serviceAccount:{sa_email(project)}"
    role = "roles/bigquery.jobUser"
    url = f"https://cloudresourcemanager.googleapis.com/v1/projects/{project}:getIamPolicy"
    status, payload = _rest(creds, "POST", url, {})
    if status != 200 or not isinstance(payload, dict):
        raise SystemExit(f"[iam] ERROR getIamPolicy HTTP {status}: {_error_message(payload)}")
    bindings = payload.setdefault("bindings", [])
    for b in bindings:
        if b.get("role") == role and member in b.get("members", []):
            print(f"[iam] {role} already on {member}")
            return
    if dry_run:
        print(f"[iam] DRY-RUN would bind {role} to {member}")
        return
    found = False
    for b in bindings:
        if b.get("role") == role:
            b.setdefault("members", []).append(member)
            found = True
            break
    if not found:
        bindings.append({"role": role, "members": [member]})
    set_url = f"https://cloudresourcemanager.googleapis.com/v1/projects/{project}:setIamPolicy"
    status, payload = _rest(creds, "POST", set_url, {"policy": {"bindings": bindings, "etag": payload.get("etag")}})
    if status != 200:
        raise SystemExit(
            f"[iam] ERROR setIamPolicy HTTP {status}: {_error_message(payload)}\n"
            "  Need resourcemanager.projects.setIamPolicy (owner). Meltano SA cannot do this."
        )
    print(f"[iam] bound {role} to {member}")


def create_key(creds, project: str, dest: Path, dry_run: bool) -> None:
    dest = dest.resolve()
    # Refuse to write inside git-tracked trees other than .secrets / tmp
    if dry_run:
        print(f"[key] DRY-RUN would write a new key to {dest}")
        return
    if dest.exists():
        raise SystemExit(f"[key] ERROR {dest} already exists; refuse to overwrite.")
    dest.parent.mkdir(parents=True, exist_ok=True)
    email = sa_email(project)
    url = f"https://iam.googleapis.com/v1/projects/{project}/serviceAccounts/{email}/keys"
    status, payload = _rest(
        creds,
        "POST",
        url,
        {"keyAlgorithm": "KEY_ALG_RSA_2048", "privateKeyType": "TYPE_GOOGLE_CREDENTIALS_FILE"},
    )
    if status not in (200, 201) or not isinstance(payload, dict) or not payload.get("privateKeyData"):
        raise SystemExit(f"[key] ERROR HTTP {status}: {_error_message(payload)}")
    blob = base64.b64decode(payload["privateKeyData"])
    # Validate it is JSON SA key without printing it.
    info = json.loads(blob)
    if info.get("type") != "service_account":
        raise SystemExit("[key] ERROR: downloaded blob is not a service_account JSON.")
    dest.write_bytes(blob)
    os.chmod(dest, 0o600)
    print(
        f"[key] wrote service_account JSON for {info.get('client_email')} -> {dest} "
        "(chmod 600). Put the file contents in GitHub secret GCP_SA_KEY_DBT. "
        "Never commit this file."
    )


def provision(args: argparse.Namespace) -> int:
    project = args.project
    location = args.location
    creds = _creds()
    client = bigquery.Client(project=project, credentials=creds)

    if args.verify_only:
        return verify(client, creds, project)

    print(f"[provision] project={project} location={location} dry_run={args.dry_run}")
    for name in DBT_DATASETS:
        ensure_dataset(client, project, name, location, args.dry_run)

    raw = describe_dataset(client, project, RAW_DEV)
    if not raw.get("exists"):
        raise SystemExit(
            f"[provision] ERROR {RAW_DEV} does not exist. Create it with the Meltano/Hito 1 flow first."
        )
    prod = describe_dataset(client, project, RAW_PROD)
    if prod.get("exists"):
        print(f"[provision] note: {RAW_PROD} exists (prod twin).")
    else:
        print(f"[provision] note: {RAW_PROD} does not exist (expected as of 2026-09-10). Not creating it.")

    if args.unset_table_expiration:
        for name in DBT_DATASETS:
            unset_expiration(client, project, name, args.dry_run)
    else:
        for name in DBT_DATASETS:
            info = describe_dataset(client, project, name)
            days = info.get("default_table_expiration_days")
            if days:
                print(
                    f"[provision] WARN {name} default table expiration={days}d "
                    "(project default). dbt tables would vanish. Re-run with "
                    "--unset-table-expiration if you want them to persist."
                )

    enable_iam_api(creds, project, args.dry_run)
    ensure_sa(creds, project, args.dry_run)
    grant_job_user(creds, project, args.dry_run)
    email = sa_email(project)
    grant_dataset_role(client, project, RAW_DEV, email, "READER", args.dry_run)
    for name in DBT_DATASETS:
        grant_dataset_role(client, project, name, email, "WRITER", args.dry_run)
    if args.tighten_acl:
        tighten_acl(client, project, args.dry_run)
    if args.create_key:
        create_key(creds, project, Path(args.create_key), args.dry_run)
    else:
        print(
            "[provision] no key created (pass --create-key /path/gitignored.json). "
            "Or: gcloud iam service-accounts keys create transform/.secrets/vm-pulse-dbt.json "
            f"--iam-account={email}"
        )
        print(
            "Then store the JSON in GitHub secret GCP_SA_KEY_DBT (not GCP_SA_KEY) "
            "and run transform/scripts/materialize-dbt-sa-key.sh"
        )
    print("[provision] done.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=_default_project(), help="GCP project id")
    parser.add_argument("--location", default=os.environ.get("BIGQUERY_LOCATION", "US"))
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--create-key", metavar="PATH", help="Write a new SA JSON key (never commit)")
    parser.add_argument("--unset-table-expiration", action="store_true")
    parser.add_argument("--tighten-acl", action="store_true", help="Remove Meltano from dbt dataset ACLs")
    args = parser.parse_args()
    if not args.project:
        print("ERROR: set BIGQUERY_PROJECT or --project", file=sys.stderr)
        return 2
    try:
        return provision(args)
    except Forbidden as e:
        print(
            f"[provision] FORBIDDEN: {e.message}\n"
            "  Run as Nicolás (owner). vm-pulse-meltano cannot enable IAM API or create SAs.",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
