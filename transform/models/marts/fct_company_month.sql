{# Company × Cap. IV month for the Pulse cut. No PARTITION BY periodo:
   sandbox 60-day cap expires 2025 months the same way fct_well_month did.
   Cluster by operator for ranking filters. #}
{{
    config(
        materialized="table",
        cluster_by=["idempresa"],
    )
}}

select
    {{ dbt_utils.generate_surrogate_key(["idempresa", "periodo"]) }} as company_month_id,
    idempresa,
    any_value(empresa) as empresa,
    periodo,
    any_value(anio) as anio,
    any_value(mes) as mes,
    any_value(days_in_month) as days_in_month,
    count(*) as well_month_row_count,
    count(distinct idpozo) as well_count,
    count(distinct if(prod_pet_m3 > 0, idpozo, null)) as wells_with_oil,
    sum(prod_pet_m3) as prod_pet_m3,
    sum(prod_gas_km3) as prod_gas_km3,
    sum(prod_agua_m3) as prod_agua_m3,
    sum(tef) as tef_sum,
    max(source_batched_at) as source_batched_at_max,
    max(fecha_data) as fecha_data_max
from {{ ref("fct_well_month") }}
group by idempresa, periodo
