with activity as (
 select fluid,periodo,sum(volume) as volume,sum(rate) as rate,count(*) as reported_well_rows,
 count(case when positive_production then 1 end) as positive_producing_wells
 from {{ ref('fct_well_activity_month') }} group by fluid,periodo
), detail as (
 select fluid,periodo,sum(volume) as volume,sum(rate) as rate,
 {% for c in ['yoy_volume','yoy_rate','mom_volume','mom_rate','yoy_volume_delta','yoy_rate_delta','mom_volume_delta','mom_rate_delta'] %}sum({{ c }}) as {{ c }},{% endfor %}
 sum(reported_well_rows) as reported_well_rows,sum(positive_producing_wells) as positive_producing_wells
 from {{ ref('fct_operator_area_month') }} group by fluid,periodo
), company as (
 select fluid,periodo,operator_group_id as entity_id,sum(volume) as volume,sum(rate) as rate
 from {{ ref('fct_operator_area_month') }} group by fluid,periodo,operator_group_id
), area as (
 select fluid,periodo,area_id as entity_id,sum(volume) as volume,sum(rate) as rate
 from {{ ref('fct_operator_area_month') }} group by fluid,periodo,area_id
)
select 'total_reconciliation' as issue from {{ ref('fct_production_month') }} t
left join activity a on a.fluid=t.fluid and a.periodo=t.periodo
left join detail d on d.fluid=t.fluid and d.periodo=t.periodo
left join {{ ref('fct_map_coverage_month') }} c on c.fluid=t.fluid and c.periodo=t.periodo
where a.fluid is null or d.fluid is null or c.fluid is null
 or abs(t.volume-a.volume)>greatest(0.000001,abs(t.volume)*1e-9)
 or abs(t.rate-a.rate)>greatest(0.000001,abs(t.rate)*1e-9)
 or abs(t.volume-c.volume)>greatest(0.000001,abs(t.volume)*1e-9)
 or t.reported_well_rows!=a.reported_well_rows or t.reported_well_rows!=c.reported_well_rows
 or t.positive_producing_wells!=a.positive_producing_wells or t.positive_producing_wells!=c.positive_producing_wells
 or t.reported_well_rows!=d.reported_well_rows or t.positive_producing_wells!=d.positive_producing_wells
 {% for key in ['volume','rate','yoy_volume','yoy_rate','mom_volume','mom_rate','yoy_volume_delta','yoy_rate_delta','mom_volume_delta','mom_rate_delta'] %}
 or (t.{{key}} is null)!=(d.{{key}} is null)
 or abs(t.{{key}}-d.{{key}})>greatest(0.000001,abs(t.{{key}})*1e-9)
 {% endfor %}
union all
select 'entity_reconciliation' from {{ ref('fct_entity_growth') }} e
left join company c on e.dimension='company' and c.fluid=e.fluid and c.periodo=e.periodo and c.entity_id=e.entity_id
left join area a on e.dimension='area' and a.fluid=e.fluid and a.periodo=e.periodo and a.entity_id=e.entity_id
where abs(e.volume-coalesce(c.volume,a.volume,0))>greatest(0.000001,abs(e.volume)*1e-9)
 or abs(e.rate-coalesce(c.rate,a.rate,0))>greatest(0.000001,abs(e.rate)*1e-9)
