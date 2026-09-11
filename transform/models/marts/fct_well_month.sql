{# Sandbox GCP caps partition expiration at 60 days. Partitioning by
   `periodo` (Cap. IV months in 2025) makes every partition older than
   that cap, so CREATE TABLE AS SELECT writes rows that expire in the
   same job — table ends at 0 rows / 0 partitions. Cluster still helps
   filters by empresa/pozo. Revisit PARTITION BY periodo when billing
   is on and partition_expiration can be NULL. #}
{{
    config(
        materialized="table",
        cluster_by=["idempresa", "idpozo"],
    )
}}

select
    well_month_id,
    idpozo,
    sigla,
    anio,
    mes,
    periodo,
    days_in_month,
    prod_pet_m3,
    prod_gas_km3,
    prod_agua_m3,
    tef,
    empresa,
    idempresa,
    formacion,
    formprod,
    tipo_de_recurso,
    sub_tipo_recurso,
    cuenca,
    provincia,
    areapermisoconcesion,
    idareapermisoconcesion,
    areayacimiento,
    idareayacimiento,
    tipopozo,
    tipoestado,
    fecha_data,
    source_batched_at
from {{ ref("int_produccion_vm_noconv") }}
