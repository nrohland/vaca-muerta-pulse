-- Fails (returns rows) if company-month oil does not match fct_well_month
-- for the same periodo and Pulse cut. Every Cap. IV month must reconcile.

with well_month as (
    select periodo, sum(prod_pet_m3) as prod_pet_m3
    from {{ ref("fct_well_month") }}
    group by 1
),

company_month as (
    select periodo, sum(prod_pet_m3) as prod_pet_m3
    from {{ ref("fct_company_month") }}
    group by 1
)

select
    coalesce(company_month.periodo, well_month.periodo) as periodo,
    company_month.prod_pet_m3 as company_prod_pet_m3,
    well_month.prod_pet_m3 as well_month_prod_pet_m3
from well_month
full outer join company_month on well_month.periodo = company_month.periodo
where
    well_month.periodo is null
    or company_month.periodo is null
    or abs(company_month.prod_pet_m3 - well_month.prod_pet_m3) > 0.0001
