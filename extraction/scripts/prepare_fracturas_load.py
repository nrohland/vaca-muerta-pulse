#!/usr/bin/env python3
"""Ensure fracturas_adjunto_iv exists with MONTH(_sdc_batched_at)+cluster.

Does NOT print credentials. Uses GOOGLE_APPLICATION_CREDENTIALS / ADC.

Adjunto IV has `empresa_informante`, not `empresa`. Pre-create so the
fracturas Meltano job (or the Python loader) can APPEND without the
production clustering_fields list.

Env:
  BIGQUERY_PROJECT   (default: vaca-muerta-pulse)
  BIGQUERY_DATASET   (required unless --dataset)
  BIGQUERY_LOCATION  (default: US)

Examples:
  python scripts/prepare_fracturas_load.py --dataset raw_cap4_dev
  python scripts/prepare_fracturas_load.py --dataset raw_cap4_dev --truncate
  python scripts/prepare_fracturas_load.py --dataset raw_cap4_dev --recreate
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from google.api_core.exceptions import Forbidden, NotFound
from google.cloud import bigquery

TABLE = "fracturas_adjunto_iv"
DDL_RELATIVE = (
    Path(__file__).resolve().parent.parent
    / "sql"
    / "create_raw_fracturas_adjunto_iv.sql"
)


def _ddl_for_dataset(dataset: str) -> str:
    raw = DDL_RELATIVE.read_text(encoding="utf-8")
    return raw.replace("raw_cap4_dev", dataset)


def _print_layout(client: bigquery.Client, project: str, dataset: str) -> None:
    table_id = f"{project}.{dataset}.{TABLE}"
    q_ddl = f"""
        SELECT table_name, ddl
        FROM `{project}.{dataset}.INFORMATION_SCHEMA.TABLES`
        WHERE table_name = @table
    """
    q_cluster = f"""
        SELECT clustering_ordinal_position, column_name
        FROM `{project}.{dataset}.INFORMATION_SCHEMA.CLUSTERING_COLUMNS`
        WHERE table_name = @table
        ORDER BY clustering_ordinal_position
    """
    q_count = f"SELECT COUNT(*) AS row_count FROM `{table_id}`"
    params = [bigquery.ScalarQueryParameter("table", "STRING", TABLE)]
    cfg = bigquery.QueryJobConfig(query_parameters=params)

    ddl_rows = list(client.query(q_ddl, job_config=cfg).result())
    if not ddl_rows:
        print(f"[prepare_fracturas_load] {table_id} not found after create", file=sys.stderr)
        return
    print(f"[prepare_fracturas_load] ddl:\n{ddl_rows[0].ddl}")
    try:
        cluster_rows = list(client.query(q_cluster, job_config=cfg).result())
        cluster = ", ".join(r.column_name for r in cluster_rows) or "(none)"
        print(f"[prepare_fracturas_load] cluster: {cluster}")
    except NotFound as exc:
        print(f"[prepare_fracturas_load] cluster INFORMATION_SCHEMA unavailable: {exc}")
        ddl = ddl_rows[0].ddl
        if "CLUSTER BY idpozo, cuenca, empresa_informante" in ddl:
            print(
                "[prepare_fracturas_load] cluster (from ddl): "
                "idpozo, cuenca, empresa_informante"
            )
    count = list(client.query(q_count).result())[0].row_count
    print(f"[prepare_fracturas_load] row_count: {count}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default=os.environ.get("BIGQUERY_DATASET"))
    parser.add_argument(
        "--project", default=os.environ.get("BIGQUERY_PROJECT", "vaca-muerta-pulse")
    )
    parser.add_argument(
        "--location", default=os.environ.get("BIGQUERY_LOCATION", "US")
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="TRUNCATE TABLE (keeps partition+cluster). Dev full refresh.",
    )
    parser.add_argument(
        "--recreate",
        action="store_true",
        help=(
            "DROP TABLE + CREATE (same MONTH+_sdc_batched_at+cluster DDL). "
            "Use when TRUNCATE/DELETE are blocked (BigQuery free tier)."
        ),
    )
    args = parser.parse_args()
    if not args.dataset:
        print("ERROR: --dataset or BIGQUERY_DATASET is required", file=sys.stderr)
        return 2
    if args.truncate and args.recreate:
        print("ERROR: use only one of --truncate, --recreate", file=sys.stderr)
        return 2

    client = bigquery.Client(project=args.project, location=args.location)
    table_id = f"{args.project}.{args.dataset}.{TABLE}"
    try:
        client.get_dataset(f"{args.project}.{args.dataset}")
    except NotFound:
        print(
            f"[prepare_fracturas_load] ERROR: dataset {args.project}.{args.dataset} "
            "does not exist. Run scripts/ensure_dataset.py first.",
            file=sys.stderr,
        )
        return 1
    except Forbidden as exc:
        print(f"[prepare_fracturas_load] ERROR: cannot read dataset: {exc}", file=sys.stderr)
        return 1

    created = False
    if args.recreate:
        try:
            client.delete_table(table_id, not_found_ok=True)
            print(f"[prepare_fracturas_load] dropped {table_id} (--recreate)")
        except Forbidden as exc:
            print(
                f"[prepare_fracturas_load] ERROR: cannot drop {table_id}: {exc}",
                file=sys.stderr,
            )
            return 1

    try:
        client.get_table(table_id)
        print(f"[prepare_fracturas_load] {table_id} already exists")
    except NotFound:
        ddl = _ddl_for_dataset(args.dataset)
        try:
            client.query(ddl).result()
            created = True
            print(
                f"[prepare_fracturas_load] created {table_id} "
                "(MONTH _sdc_batched_at + cluster idpozo, cuenca, empresa_informante)"
            )
        except Forbidden as exc:
            print(
                f"[prepare_fracturas_load] ERROR: cannot create {table_id}: {exc}",
                file=sys.stderr,
            )
            return 1

    if args.truncate:
        client.query(f"TRUNCATE TABLE `{table_id}`").result()
        print(f"[prepare_fracturas_load] truncated {table_id} (layout preserved)")

    _print_layout(client, args.project, args.dataset)
    if created:
        print(
            "[prepare_fracturas_load] next: meltano run cap4-fracturas "
            "(or python scripts/load_fracturas_datastore.py)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
