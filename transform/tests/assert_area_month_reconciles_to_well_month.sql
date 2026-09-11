-- Fails (returns rows) if area-month oil does not match fct_well_month
-- for the same periodo and Pulse cut. Every Cap. IV month must reconcile.

with well_month as (
    select periodo, sum(prod_pet_m3) as prod_pet_m3
    from {{ ref("fct_well_month") }}
    group by 1
),

area_month as (
    select periodo, sum(prod_pet_m3) as prod_pet_m3
    from {{ ref("fct_area_month") }}
    group by 1
)

select
    coalesce(area_month.periodo, well_month.periodo) as periodo,
    area_month.prod_pet_m3 as area_prod_pet_m3,
    well_month.prod_pet_m3 as well_month_prod_pet_m3
from well_month
full outer join area_month on well_month.periodo = area_month.periodo
where
    well_month.periodo is null
    or area_month.periodo is null
    or abs(area_month.prod_pet_m3 - well_month.prod_pet_m3) > 0.0001
