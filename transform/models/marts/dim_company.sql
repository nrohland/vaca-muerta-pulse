{# Distinct operators in the Pulse cut. Grain = one row per idempresa.
   Names are any_value from fct_well_month; a singular test fails if one
   idempresa maps to more than one empresa string in the same warehouse. #}
{{
    config(
        materialized="table",
        cluster_by=["idempresa"],
    )
}}

select
    idempresa,
    any_value(empresa) as empresa,
    count(distinct idpozo) as well_count,
    min(periodo) as first_periodo,
    max(periodo) as last_periodo
from {{ ref("fct_well_month") }}
group by 1
