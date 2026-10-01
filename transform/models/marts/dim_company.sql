{{ config(materialized="table", cluster_by=["idempresa"]) }}
with history as (
 select * from {{ ref('fct_well_month') }}
), latest as (
 select idempresa,empresa, periodo as name_periodo from history
 qualify row_number() over(partition by idempresa order by periodo desc, empresa desc)=1
), summary as (
 select idempresa,count(distinct idpozo) as well_count,
 count(distinct empresa) as historical_name_count,
 min(periodo) as first_periodo,max(periodo) as last_periodo
 from history group by idempresa
)
select s.*,l.empresa,l.name_periodo from summary s join latest l using (idempresa)
