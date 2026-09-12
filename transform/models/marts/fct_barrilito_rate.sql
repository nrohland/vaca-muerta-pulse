{{ config(materialized="table") }}

with
    well_month as (select * from {{ ref("fct_well_month") }}),

    latest as (select max(periodo) as periodo from well_month),

    aggregated as (
        select
            well_month.periodo,
            max(well_month.anio) as anio,
            max(well_month.mes) as mes,
            sum(well_month.prod_pet_m3) as prod_pet_m3,
            sum(well_month.tef) as tef_sum,
            max(well_month.days_in_month) as days_in_month,
            count(*) as well_month_row_count,
            max(well_month.source_batched_at) as source_batched_at_max,
            max(well_month.fecha_data) as fecha_data_max
        from well_month
        inner join latest on well_month.periodo = latest.periodo
        group by 1
    ),

    rated as (
        select
            *,
            -- Headline = basin calendar rate, not well-day productivity.
            prod_pet_m3 / nullif(days_in_month, 0) as rate_m3_dia,
            prod_pet_m3 / nullif(tef_sum, 0) as productivity_m3_dia,
            "calendar_days" as rate_method
        from aggregated
    )

select
    periodo,
    anio,
    mes,
    prod_pet_m3,
    tef_sum,
    days_in_month,
    well_month_row_count,
    rate_m3_dia,
    rate_m3_dia as rate_m3_per_day,
    {{ m3_to_bbl("rate_m3_dia") }} as rate_bbl_dia,
    {{ m3_to_bbl("rate_m3_dia") }} as rate_bbl_per_day,
    productivity_m3_dia,
    {{ m3_to_bbl("productivity_m3_dia") }} as productivity_bbl_dia,
    rate_method,
    source_batched_at_max,
    fecha_data_max,
    true as is_simulation,
    "simulación a partir de datos mensuales oficiales" as disclaimer
from rated
