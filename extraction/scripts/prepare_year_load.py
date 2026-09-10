#!/usr/bin/env python3
"""Ensure produccion_pozo_mes exists with MONTH(_sdc_batched_at)+cluster.

Does NOT print credentials. Uses GOOGLE_APPLICATION_CREDENTIALS / ADC.

Why: z3z1ma overwrite:true does CREATE OR REPLACE TABLE AS SELECT * and
BigQuery refuses to replace a partitioned table with an unpartitioned CTAS.
This script pre-creates (IF NOT EXISTS) the partitioned table so append loads
land on the final table. Reload = TRUNCATE or DELETE year, then meltano append.

Env:
  BIGQUERY_PROJECT   (default: vaca-muerta-pulse)
  BIGQUERY_DATASET   (required unless --dataset)
  BIGQUERY_LOCATION  (default: US)

Examples:
  python scripts/prepare_year_load.py --dataset raw_cap4_dev
  python scripts/prepare_year_load.py --dataset raw_cap4_dev --truncate
  python scripts/prepare_year_load.py --dataset raw_cap4_dev --recreate
  python scripts/prepare_year_load.py --dataset raw_cap4 --delete-year 2025
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from google.api_core.exceptions import Forbidden, NotFound
from google.cloud import bigquery

TABLE = "produccion_pozo_mes"
DDL_RELATIVE = Path(__file__).resolve().parent.parent / "sql" / "create_produccion_pozo_mes.sql"


def _ddl_for_dataset(dataset: str) -> str:
    raw = DDL_RELATIVE.read_text(encoding="utf-8")
    # The checked-in file targets raw_cap4_dev; swap dataset id only.
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
        print(f"[prepare_year_load] {table_id} not found after create", file=sys.stderr)
        return
    print(f"[prepare_year_load] ddl:\n{ddl_rows[0].ddl}")
    try:
        cluster_rows = list(client.query(q_cluster, job_config=cfg).result())
        cluster = ", ".join(r.column_name for r in cluster_rows) or "(none)"
        print(f"[prepare_year_load] cluster: {cluster}")
    except NotFound as exc:
        # Some projects expose TABLES.ddl but not CLUSTERING_COLUMNS.
        print(f"[prepare_year_load] cluster INFORMATION_SCHEMA unavailable: {exc}")
        ddl = ddl_rows[0].ddl
        if "CLUSTER BY empresa, idpozo, cuenca" in ddl:
            print("[prepare_year_load] cluster (from ddl): empresa, idpozo, cuenca")
    count = list(client.query(q_count).result())[0].row_count
    print(f"[prepare_year_load] row_count: {count}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default=os.environ.get("BIGQUERY_DATASET"))
    parser.add_argument("--project", default=os.environ.get("BIGQUERY_PROJECT", "vaca-muerta-pulse"))
    parser.add_argument("--location", default=os.environ.get("BIGQUERY_LOCATION", "US"))
    parser.add_argument(
        "--delete-year",
        type=int,
        default=None,
        help="DELETE WHERE anio=@year (keeps partition+cluster). Then append.",
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
            "Use when TRUNCATE/DELETE are blocked (BigQuery free tier: DML not allowed)."
        ),
    )
    args = parser.parse_args()
    if not args.dataset:
        print("ERROR: --dataset or BIGQUERY_DATASET is required", file=sys.stderr)
        return 2
    exclusive = [args.truncate, args.delete_year is not None, args.recreate]
    if sum(1 for flag in exclusive if flag) > 1:
        print(
            "ERROR: use only one of --truncate, --delete-year, --recreate",
            file=sys.stderr,
        )
        return 2

    client = bigquery.Client(project=args.project, location=args.location)
    table_id = f"{args.project}.{args.dataset}.{TABLE}"
    try:
        client.get_dataset(f"{args.project}.{args.dataset}")
    except NotFound:
        print(
            f"[prepare_year_load] ERROR: dataset {args.project}.{args.dataset} "
            "does not exist. Run scripts/ensure_dataset.py first.",
            file=sys.stderr,
        )
        return 1
    except Forbidden as exc:
        print(f"[prepare_year_load] ERROR: cannot read dataset: {exc}", file=sys.stderr)
        return 1

    created = False
    if args.recreate:
        try:
            client.delete_table(table_id, not_found_ok=True)
            print(f"[prepare_year_load] dropped {table_id} (--recreate)")
        except Forbidden as exc:
            print(
                f"[prepare_year_load] ERROR: cannot drop {table_id}: {exc}",
                file=sys.stderr,
            )
            return 1

    try:
        client.get_table(table_id)
        print(f"[prepare_year_load] {table_id} already exists")
    except NotFound:
        ddl = _ddl_for_dataset(args.dataset)
        try:
            client.query(ddl).result()
            created = True
            print(f"[prepare_year_load] created {table_id} (MONTH _sdc_batched_at + cluster)")
        except Forbidden as exc:
            print(
                f"[prepare_year_load] ERROR: cannot create {table_id}: {exc}",
                file=sys.stderr,
            )
            return 1

    if args.truncate:
        client.query(f"TRUNCATE TABLE `{table_id}`").result()
        print(f"[prepare_year_load] truncated {table_id} (layout preserved)")
    elif args.delete_year is not None:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("year", "INT64", args.delete_year),
            ]
        )
        job = client.query(
            f"DELETE FROM `{table_id}` WHERE anio = @year",
            job_config=job_config,
        )
        job.result()
        print(
            f"[prepare_year_load] deleted anio={args.delete_year} from {table_id} "
            f"(dml_rows={job.num_dml_affected_rows})"
        )

    _print_layout(client, args.project, args.dataset)
    if created:
        print("[prepare_year_load] next: meltano run cap4-produccion (overwrite must stay false)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
