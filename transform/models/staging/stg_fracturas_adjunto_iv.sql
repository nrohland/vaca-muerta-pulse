{{ config(materialized="view", tags=["staging", "adjunto_iv"]) }}
{# Adjunto IV jobs. Pulse filter mirrors production: Vaca Muerta + no convencional.
   Business event date = fecha_inicio_fractura. Source anio/mes/periodo may be
   carga — do not treat them as fracture start. #}

with
    source as (select * from {{ source("raw_cap4", "fracturas_adjunto_iv") }}),

    renamed as (
        select
            cast(id_base_fractura_adjiv as int64) as id_base_fractura_adjiv,
            cast(idpozo as int64) as idpozo,
            cast(sigla as string) as sigla,
            cast(cuenca as string) as cuenca,
            cast(areapermisoconcesion as string) as areapermisoconcesion,
            cast(yacimiento as string) as yacimiento,
            cast(formacion_productiva as string) as formacion_productiva,
            cast(tipo_reservorio as string) as tipo_reservorio,
            cast(subtipo_reservorio as string) as subtipo_reservorio,
            cast(longitud_rama_horizontal_m as float64) as longitud_rama_horizontal_m,
            cast(cantidad_fracturas as int64) as cantidad_fracturas,
            cast(tipo_terminacion as string) as tipo_terminacion,
            cast(arena_bombeada_nacional_tn as float64) as arena_bombeada_nacional_tn,
            cast(arena_bombeada_importada_tn as float64) as arena_bombeada_importada_tn,
            cast(agua_inyectada_m3 as float64) as agua_inyectada_m3,
            cast(co2_inyectado_m3 as float64) as co2_inyectado_m3,
            cast(presion_maxima_psi as float64) as presion_maxima_psi,
            cast(potencia_equipos_fractura_hp as float64) as potencia_equipos_fractura_hp,
            timestamp(fecha_inicio_fractura) as fecha_inicio_fractura,
            timestamp(fecha_fin_fractura) as fecha_fin_fractura,
            date(fecha_inicio_fractura) as fecha_inicio,
            date(fecha_fin_fractura) as fecha_fin,
            timestamp(fecha_data) as fecha_data,
            cast(anio_if as int64) as anio_if,
            cast(mes_if as int64) as mes_if,
            cast(anio_ff as int64) as anio_ff,
            cast(mes_ff as int64) as mes_ff,
            cast(anio_carga as int64) as anio_carga,
            cast(mes_carga as int64) as mes_carga,
            cast(empresa_informante as string) as empresa_informante,
            cast(anio as int64) as source_anio,
            cast(mes as int64) as source_mes,
            coalesce(
                periodo, date(cast(anio as int64), cast(mes as int64), 1)
            ) as source_periodo,
            _sdc_batched_at as source_batched_at,
            _sdc_extracted_at as source_extracted_at
        from source
        where
            formacion_productiva = '{{ var("vm_formacion") }}'
            and tipo_reservorio = '{{ var("vm_tipo_de_recurso") }}'
            and id_base_fractura_adjiv is not null
    ),

    deduped as (
        select *
        from renamed
        qualify
            row_number() over (
                partition by id_base_fractura_adjiv
                order by
                    coalesce(source_batched_at, timestamp("1970-01-01")) desc,
                    coalesce(source_extracted_at, timestamp("1970-01-01")) desc
            )
            = 1
    )

select *
from deduped
