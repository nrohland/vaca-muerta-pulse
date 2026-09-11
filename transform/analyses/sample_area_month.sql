-- Sample for Front/IA. Ranking of permiso/concesión areas in a Cap. IV month.
-- Preferred area grain: idareapermisoconcesion. Do not query raw_*.

select
    periodo,
    anio,
    mes,
    idareapermisoconcesion,
    areapermisoconcesion,
    prod_pet_m3,
    wells_with_oil,
    well_count,
    company_count,
    tef_sum
from {{ ref("fct_area_month") }}
order by periodo desc, prod_pet_m3 desc
