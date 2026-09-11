-- Sample for Front/IA. Ranking of companies in a Cap. IV month.
-- Do not query raw_*. Headline Barrilito stays on fct_barrilito_rate.

select
    periodo,
    anio,
    mes,
    idempresa,
    empresa,
    prod_pet_m3,
    wells_with_oil,
    well_count,
    tef_sum
from {{ ref("fct_company_month") }}
order by periodo desc, prod_pet_m3 desc
