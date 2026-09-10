-- Fails (returns rows) if Barrilito oil does not match fct_well_month
-- for the same latest periodo and Pulse cut.
-- Grain of the mart is one row; this is the Hito 2 reconciliation test.

select
    barrilito.periodo,
    barrilito.prod_pet_m3 as barrilito_prod_pet_m3,
    well_month.prod_pet_m3 as well_month_prod_pet_m3
from {{ ref("fct_barrilito_rate") }} as barrilito
inner join
    (
        select periodo, sum(prod_pet_m3) as prod_pet_m3
        from {{ ref("fct_well_month") }}
        group by 1
    ) as well_month
    on barrilito.periodo = well_month.periodo
where abs(barrilito.prod_pet_m3 - well_month.prod_pet_m3) > 0.0001
