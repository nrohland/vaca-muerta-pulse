{{
    config(
        materialized="table",
        partition_by={"field": "periodo", "data_type": "date", "granularity": "month"},
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
