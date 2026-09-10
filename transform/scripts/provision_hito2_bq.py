#!/usr/bin/env python3
"""Idempotent Hito 2 BQ provision: datasets + IAM for vm-pulse-dbt.

Creates stg_cap4_dev / int_cap4_dev / marts_cap4_dev (US) if missing.
Tries to create the dbt SA and grant roles. The Meltano SA cannot enable
iam.googleapis.com — Nicolás runs scripts/provision_hito2_bq.sh as owner.

Never creates or prints a key.
"""
from __future__ import annotations

import os
import sys

from google.api_core.exceptions import Forbidden, NotFound
from google.cloud import bigquery
from google.cloud.bigquery.dataset import AccessEntry
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def _project(creds) -> str:
    return (
        os.environ.get("DBT_BIGQUERY_PROJECT")
        or os.environ.get("BIGQUERY_PROJECT")
        or creds.project_id
        or ""
    )


def _creds():
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not path:
        print("ERROR: set GOOGLE_APPLICATION_CREDENTIALS", file=sys.stderr)
        raise SystemExit(2)
    return service_account.Credentials.from_service_account_file(
        path,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )


def ensure_datasets(bq: bigquery.Client, project: str, location: str) -> None:
    wanted = (
        ("stg_cap4_dev", "Hito 2 dbt staging (dev). Meltano does not write here."),
        ("int_cap4_dev", "Hito 2 dbt intermediate (dev). Meltano does not write here."),
        ("marts_cap4_dev", "Hito 2 dbt marts (dev). Meltano does not write here."),
    )
    for name, description in wanted:
        dataset_id = f"{project}.{name}"
        try:
            ds = bq.get_dataset(dataset_id)
            print(f"[dataset] exists {ds.dataset_id} location={ds.location} created={ds.created}")
            continue
        except NotFound:
            pass
        ref = bigquery.Dataset(dataset_id)
        ref.location = location
        ref.description = description
        try:
            ds = bq.create_dataset(ref, exists_ok=True)
            print(f"[dataset] created {ds.dataset_id} location={ds.location}")
        except Forbidden as e:
            print(f"[dataset] cannot create {name}: {e}", file=sys.stderr)
            raise SystemExit(1)


def dump_datasets(bq: bigquery.Client, project: str, names: tuple[str, ...]) -> None:
    print("[evidence] datasets")
    for name in names:
        try:
            ds = bq.get_dataset(f"{project}.{name}")
            print(f"  {ds.dataset_id} location={ds.location} created={ds.created}")
        except NotFound:
            print(f"  {name} NOT FOUND")


def ensure_sa(creds, project: str, email: str) -> bool:
    iam = build("iam", "v1", credentials=creds, cache_discovery=False)
    name = f"projects/{project}/serviceAccounts/{email}"
    try:
        sa = iam.projects().serviceAccounts().get(name=name).execute()
        print(f"[sa] exists {sa.get('email')} disabled={sa.get('disabled')}")
        return True
    except HttpError as e:
        if e.resp.status != 404:
            print(f"[sa] get failed HTTP {e.resp.status} {e.reason}", file=sys.stderr)
            actor = getattr(creds, "service_account_email", "")
            if actor == email:
                print("[sa] IAM API blocked but actor *is* the dbt SA — continue grants")
                return True
            print(
                "[sa] Nico: enable iam.googleapis.com and run "
                "transform/scripts/provision_hito2_bq.sh",
                file=sys.stderr,
            )
            return False
    body = {
        "accountId": "vm-pulse-dbt",
        "serviceAccount": {
            "displayName": "vm-pulse-dbt",
            "description": "Hito 2 dbt: read raw_*, write stg/int/marts. Not Meltano.",
        },
    }
    try:
        sa = (
            iam.projects()
            .serviceAccounts()
            .create(name=f"projects/{project}", body=body)
            .execute()
        )
        print(f"[sa] created {sa.get('email')}")
        return True
    except HttpError as e:
        print(f"[sa] create failed HTTP {e.resp.status} {e.reason}", file=sys.stderr)
        return False


def grant_project_job_user(creds, project: str, email: str) -> None:
    crm = build("cloudresourcemanager", "v1", credentials=creds, cache_discovery=False)
    member = f"serviceAccount:{email}"
    role = "roles/bigquery.jobUser"
    try:
        policy = crm.projects().getIamPolicy(resource=project, body={}).execute()
    except HttpError as e:
        print(f"[project-iam] get failed HTTP {e.resp.status} {e.reason}", file=sys.stderr)
        return
    bindings = policy.setdefault("bindings", [])
    for b in bindings:
        if b.get("role") == role and member in b.get("members", []):
            print(f"[project-iam] already has {role}")
            return
    for b in bindings:
        if b.get("role") == role:
            b.setdefault("members", []).append(member)
            break
    else:
        bindings.append({"role": role, "members": [member]})
    try:
        crm.projects().setIamPolicy(resource=project, body={"policy": policy}).execute()
        print(f"[project-iam] granted {role}")
    except HttpError as e:
        print(f"[project-iam] set failed HTTP {e.resp.status} {e.reason}", file=sys.stderr)


def grant_dataset_role(
    bq: bigquery.Client, project: str, dataset: str, email: str, role: str
) -> None:
    try:
        ds = bq.get_dataset(f"{project}.{dataset}")
    except NotFound:
        print(f"[dataset-iam] skip {dataset} (missing)")
        return
    existing = {(a.role, a.entity_type, a.entity_id) for a in ds.access_entries}
    wanted = (role, "userByEmail", email)
    if wanted in existing:
        print(f"[dataset-iam] {dataset} already {role} for dbt SA")
        return
    entries = list(ds.access_entries)
    entries.append(AccessEntry(role=role, entity_type="userByEmail", entity_id=email))
    ds.access_entries = entries
    try:
        bq.update_dataset(ds, ["access_entries"])
        print(f"[dataset-iam] {dataset} granted {role}")
    except Exception as e:
        print(f"[dataset-iam] {dataset} failed: {type(e).__name__}: {e}", file=sys.stderr)


def main() -> int:
    creds = _creds()
    project = _project(creds)
    location = os.environ.get("BIGQUERY_LOCATION", "US")
    email = f"vm-pulse-dbt@{project}.iam.gserviceaccount.com"
    print(f"[hito2] actor={creds.service_account_email} project={project}")
    print(f"[hito2] target SA={email}")

    bq = bigquery.Client(project=project, credentials=creds)
    ensure_datasets(bq, project, location)
    dump_datasets(
        bq,
        project,
        ("raw_cap4_dev", "raw_cap4", "stg_cap4_dev", "int_cap4_dev", "marts_cap4_dev"),
    )

    if not ensure_sa(creds, project, email):
        print("[hito2] SA missing — dataset grants skipped. Run provision_hito2_bq.sh as Nico.")
        return 0

    grant_project_job_user(creds, project, email)
    grant_dataset_role(bq, project, "raw_cap4_dev", email, "READER")
    grant_dataset_role(bq, project, "raw_cap4", email, "READER")
    for ds in ("stg_cap4_dev", "int_cap4_dev", "marts_cap4_dev"):
        grant_dataset_role(bq, project, ds, email, "WRITER")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
