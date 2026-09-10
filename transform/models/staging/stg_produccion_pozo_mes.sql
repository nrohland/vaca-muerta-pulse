{{ config(materialized="view") }}
{# Primary source dataset: var raw_dataset (default raw_cap4_dev). Prod twin: raw_cap4. #}

with
    source as (select * from {{ source("raw_cap4", "produccion_pozo_mes") }}),

    renamed as (
        select
            cast(idpozo as int64) as idpozo,
            cast(sigla as string) as sigla,
            cast(anio as int64) as anio,
            cast(mes as int64) as mes,
            coalesce(
                periodo, date(cast(anio as int64), cast(mes as int64), 1)
            ) as periodo,
            cast(prod_pet as float64) as prod_pet_m3,
            cast(prod_gas as float64) as prod_gas_km3,
            cast(prod_agua as float64) as prod_agua_m3,
            cast(tef as float64) as tef,
            cast(empresa as string) as empresa,
            cast(idempresa as string) as idempresa,
            cast(formacion as string) as formacion,
            cast(formprod as string) as formprod,
            cast(tipo_de_recurso as string) as tipo_de_recurso,
            cast(sub_tipo_recurso as string) as sub_tipo_recurso,
            cast(cuenca as string) as cuenca,
            cast(provincia as string) as provincia,
            cast(areapermisoconcesion as string) as areapermisoconcesion,
            cast(idareapermisoconcesion as string) as idareapermisoconcesion,
            cast(areayacimiento as string) as areayacimiento,
            cast(idareayacimiento as string) as idareayacimiento,
            cast(tipopozo as string) as tipopozo,
            cast(tipoestado as string) as tipoestado,
            cast(tipoextraccion as string) as tipoextraccion,
            cast(profundidad as float64) as profundidad,
            cast(rectificado as string) as rectificado,
            cast(habilitado as string) as habilitado,
            fechaingreso,
            fecha_data,
            _sdc_batched_at as source_batched_at,
            _sdc_extracted_at as source_extracted_at
        from source
        where
            formacion = '{{ var("vm_formacion") }}'
            and tipo_de_recurso = '{{ var("vm_tipo_de_recurso") }}'
            and idpozo is not null
            and anio is not null
            and mes is not null
    ),

    deduped as (
        select *
        from renamed
        qualify
            row_number() over (
                partition by idpozo, anio, mes
                order by
                    case when lower(coalesce(rectificado, "f")) = "t" then 0 else 1 end,
                    coalesce(source_batched_at, timestamp("1970-01-01")) desc,
                    coalesce(source_extracted_at, timestamp("1970-01-01")) desc
            )
            = 1
    )

select *
from deduped
