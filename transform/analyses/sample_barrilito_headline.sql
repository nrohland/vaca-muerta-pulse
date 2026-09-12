-- Sample for Front/IA. Run via `dbt compile --select sample_barrilito_headline`
-- or paste against the marts dataset after `dbt build`. Do not query raw_*.

select
    periodo,
    anio,
    mes,
    rate_bbl_dia,
    rate_m3_dia,
    productivity_bbl_dia,
    rate_method,
    prod_pet_m3,
    tef_sum,
    days_in_month,
    source_batched_at_max,
    fecha_data_max,
    is_simulation,
    disclaimer
from {{ ref("fct_barrilito_rate") }}
