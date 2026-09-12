#!/usr/bin/env python3
"""Refresh apps/spike/data/*.csv from marts_cap4_dev. Never queries raw_*."""

from pathlib import Path

from google.cloud import bigquery

OUT = Path(__file__).resolve().parent / "data"
PROJECT = "vaca-muerta-pulse"

QUERIES = {
    "headline.csv": """
        select
          periodo, anio, mes,
          prod_pet_m3, tef_sum, days_in_month, well_month_row_count,
          rate_m3_dia, rate_bbl_dia, productivity_m3_dia, productivity_bbl_dia, rate_method,
          is_simulation, disclaimer,
          source_batched_at_max, fecha_data_max
        from `vaca-muerta-pulse.marts_cap4_dev.fct_barrilito_rate`
    """,
    "monthly_pulse.csv": """
        select
          periodo, anio, mes,
          count(*) as company_count,
          sum(prod_pet_m3) as prod_pet_m3,
          sum(prod_gas_km3) as prod_gas_km3,
          sum(prod_agua_m3) as prod_agua_m3,
          sum(tef_sum) as tef_sum,
          sum(wells_with_oil) as wells_with_oil,
          sum(well_count) as well_count
        from `vaca-muerta-pulse.marts_cap4_dev.fct_company_month`
        group by 1, 2, 3
        order by 1
    """,
    "company_latest.csv": """
        select
          periodo, anio, mes, idempresa, empresa,
          prod_pet_m3, prod_gas_km3, wells_with_oil, well_count, tef_sum
        from `vaca-muerta-pulse.marts_cap4_dev.fct_company_month`
        qualify periodo = max(periodo) over ()
        order by prod_pet_m3 desc
    """,
    "area_latest.csv": """
        select
          periodo, anio, mes,
          idareapermisoconcesion, areapermisoconcesion,
          prod_pet_m3, prod_gas_km3, wells_with_oil, well_count,
          company_count, tef_sum
        from `vaca-muerta-pulse.marts_cap4_dev.fct_area_month`
        qualify periodo = max(periodo) over ()
        order by prod_pet_m3 desc
    """,
    "company_top5_month.csv": """
        with latest as (
          select max(periodo) as periodo
          from `vaca-muerta-pulse.marts_cap4_dev.fct_company_month`
        ),
        top5 as (
          select idempresa
          from `vaca-muerta-pulse.marts_cap4_dev.fct_company_month`
          join latest using (periodo)
          order by prod_pet_m3 desc
          limit 5
        )
        select
          c.periodo, c.anio, c.mes, c.idempresa, c.empresa,
          c.prod_pet_m3, c.wells_with_oil
        from `vaca-muerta-pulse.marts_cap4_dev.fct_company_month` c
        join top5 using (idempresa)
        order by c.periodo, c.prod_pet_m3 desc
    """,
}


def main() -> None:
    client = bigquery.Client(project=PROJECT, location="US")
    OUT.mkdir(parents=True, exist_ok=True)
    for name, sql in QUERIES.items():
        job = client.query(sql, location="US")
        df = job.result().to_dataframe()
        path = OUT / name
        df.to_csv(path, index=False)
        print(f"{name}: n={len(df)} job={job.job_id}")


if __name__ == "__main__":
    main()
