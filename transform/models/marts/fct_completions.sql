{# Adjunto IV completions. Not Cap. IV. No PARTITION BY fecha_inicio in
   sandbox (2006–2025 would expire). Cluster idpozo like well-month. #}
{{
    config(
        materialized="table",
        cluster_by=["idpozo"],
        tags=["marts", "adjunto_iv"],
    )
}}

select
    id_base_fractura_adjiv,
    idpozo,
    sigla,
    cuenca,
    areapermisoconcesion,
    yacimiento,
    formacion_productiva,
    tipo_reservorio,
    subtipo_reservorio,
    empresa_informante,
    fecha_inicio,
    fecha_fin,
    fecha_inicio_fractura,
    fecha_fin_fractura,
    cantidad_fracturas,
    tipo_terminacion,
    longitud_rama_horizontal_m,
            arena_bombeada_nacional_tn,
            arena_bombeada_importada_tn,
            if(
                arena_bombeada_nacional_tn is null
                and arena_bombeada_importada_tn is null,
                null,
                coalesce(arena_bombeada_nacional_tn, 0)
                + coalesce(arena_bombeada_importada_tn, 0)
            ) as arena_bombeada_tn,
    agua_inyectada_m3,
    co2_inyectado_m3,
    presion_maxima_psi,
    potencia_equipos_fractura_hp,
    anio_if,
    mes_if,
    source_anio,
    source_mes,
    source_periodo,
    fecha_data,
    source_batched_at
from {{ ref("stg_fracturas_adjunto_iv") }}
