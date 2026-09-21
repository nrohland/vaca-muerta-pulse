{# Monthly rollup of Adjunto IV jobs by fecha_inicio (not source_periodo). #}
{{
    config(
        materialized="table",
        cluster_by=["periodo"],
        tags=["marts", "adjunto_iv"],
    )
}}

select
    date_trunc(fecha_inicio, month) as periodo,
    extract(year from fecha_inicio) as anio,
    extract(month from fecha_inicio) as mes,
    count(*) as job_count,
    count(distinct idpozo) as well_count,
    sum(cantidad_fracturas) as etapas,
    sum(arena_bombeada_nacional_tn) as arena_nacional_tn,
    sum(arena_bombeada_importada_tn) as arena_importada_tn,
    sum(arena_bombeada_tn) as arena_tn,
    sum(agua_inyectada_m3) as agua_inyectada_m3,
    max(source_batched_at) as source_batched_at_max
from {{ ref("fct_completions") }}
where fecha_inicio is not null
group by 1, 2, 3
