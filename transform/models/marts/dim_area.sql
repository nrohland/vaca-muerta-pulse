{# Distinct permiso/concesión areas in the Pulse cut. Grain = one row per
   idareapermisoconcesion. Inter-year id stability remains UNKNOWN (only
   2025 is loaded). #}
{{
    config(
        materialized="table",
        cluster_by=["idareapermisoconcesion"],
    )
}}

select
    idareapermisoconcesion,
    any_value(areapermisoconcesion) as areapermisoconcesion,
    count(distinct idpozo) as well_count,
    count(distinct idempresa) as company_count,
    min(periodo) as first_periodo,
    max(periodo) as last_periodo
from {{ ref("fct_well_month") }}
group by 1
