{{ config(materialized="table", cluster_by=["idareapermisoconcesion"]) }}
with history as (
 select * from {{ ref('fct_well_month') }}
), latest as (
 select idareapermisoconcesion,areapermisoconcesion, periodo as name_periodo from history
 qualify row_number() over(partition by idareapermisoconcesion order by periodo desc, areapermisoconcesion desc)=1
), summary as (
 select idareapermisoconcesion,count(distinct idpozo) as well_count,count(distinct idempresa) as company_count,
 count(distinct areapermisoconcesion) as historical_name_count,
 min(periodo) as first_periodo,max(periodo) as last_periodo
 from history group by idareapermisoconcesion
)
select s.*,l.areapermisoconcesion,l.name_periodo from summary s join latest l using (idareapermisoconcesion)
