{% macro activity_geo_input() %}
{% if target.type == 'duckdb' %}{{ ref('synthetic_well_geo') }}{% else %}{{ source('raw_geography','capitulo_iv_pozos') }}{% endif %}
{% endmacro %}
{% macro activity_area_input() %}
{% if target.type == 'duckdb' %}{{ ref('synthetic_area_geo') }}{% else %}{{ source('raw_geography','concessions_geography') }}{% endif %}
{% endmacro %}

{% macro well_activity_month() %}
with {{ publication_base() }}
select f.fluid, f.periodo, f.idpozo,
 cast(f.idempresa as {{ dbt.type_string() }}) as legal_operator_id,
 f.empresa as legal_operator_name,
 f.publication_operator_id as operator_group_id,
 f.publication_operator_name as operator_group_name,
 f.operator_group_rule_version,
 cast(f.idareapermisoconcesion as {{ dbt.type_string() }}) as area_id,
 f.areapermisoconcesion as area_name,
 f.cuenca, f.sigla, f.tipoestado, f.tipopozo,
 f.volume, f.volume_unit,
 f.volume / {{ cap4_days_in_month('f.periodo') }} as rate,
 f.volume > 0 as positive_production,
 g.idpozo is not null as catalog_present,
 coalesce(g.coordinate_valid,false) as coordinate_valid,
 case when g.coordinate_valid then g.longitude end as longitude,
 case when g.coordinate_valid then g.latitude end as latitude,
 case when g.idpozo is null then 'missing_catalog_id'
      when not coalesce(g.coordinate_valid,false) then coalesce(g.coordinate_issue,'invalid_coordinate') end as coordinate_issue,
 g.catalog_at, g.source_resource_id as geo_source_resource_id,
 a.area_id is not null and a.geometry_status='valid' as area_geometry_available,
 case when a.area_id is null then 'missing_or_quarantined_area' when a.geometry_status!='valid' then a.geometry_status end as area_geometry_issue,
 f.source_batched_at as production_loaded_at
from publication_operators f
left join {{ activity_geo_input() }} g on f.idpozo=g.idpozo
left join {{ activity_area_input() }} a on cast(f.idareapermisoconcesion as {{ dbt.type_string() }})=a.area_id
{% endmacro %}

{% macro activity_coverage_columns() %}
count(*) as reported_well_rows,
count(volume) as valid_volume_rows,
count(case when positive_production then 1 end) as positive_producing_wells,
count(case when coordinate_valid then 1 end) as located_well_rows,
count(case when not catalog_present then 1 end) as missing_catalog_well_rows,
count(case when catalog_present and not coordinate_valid then 1 end) as invalid_coordinate_well_rows,
count(case when positive_production and coordinate_valid then 1 end) as located_positive_wells,
count(case when positive_production and not coordinate_valid then 1 end) as unlocated_positive_wells,
1.0*count(case when coordinate_valid then 1 end)/nullif(count(*),0) as coordinate_coverage,
1.0*count(case when positive_production and coordinate_valid then 1 end)/nullif(count(case when positive_production then 1 end),0) as positive_coordinate_coverage,
count(case when not area_geometry_available then 1 end) as missing_area_well_rows,
count(distinct case when not area_geometry_available then area_id end) as missing_area_ids
{% endmacro %}

{% macro map_coverage_month() %}
select fluid,periodo,volume_unit,sum(volume) as volume,sum(rate) as rate,
 {{ activity_coverage_columns() }}
from {{ ref('fct_well_activity_month') }} group by fluid,periodo,volume_unit
{% endmacro %}

{% macro operator_area_month() %}
with {{ publication_base() }}, monthly as (
 select fluid,periodo,operator_group_id,area_id,volume_unit,
 max(operator_group_name) as operator_group_name,max(area_name) as area_name,
 sum(volume) as volume,sum(rate) as rate,
 {{ activity_coverage_columns() }}
 from {{ ref('fct_well_activity_month') }}
 group by fluid,periodo,operator_group_id,area_id,volume_unit
), universe as (
 select fluid,periodo,operator_group_id,area_id,volume_unit from monthly
 union distinct
 select m.fluid,a.periodo,m.operator_group_id,m.area_id,m.volume_unit from monthly m
 join accepted a on m.periodo={{ publication_shift('a.periodo',-12) }} or m.periodo={{ publication_shift('a.periodo',-1) }}
), names as (
 select operator_group_id,area_id,operator_group_name,area_name from monthly
 qualify row_number() over(partition by operator_group_id,area_id order by periodo desc,operator_group_name desc,area_name desc)=1
), compared as (
 select u.*,n.operator_group_name,n.area_name,
 coalesce(m.volume,0) as volume,coalesce(m.rate,0) as rate,
 case when ay.periodo is not null then coalesce(y.volume,0) end as yoy_volume,
 case when ay.periodo is not null then coalesce(y.rate,0) end as yoy_rate,
 case when ap.periodo is not null then coalesce(p.volume,0) end as mom_volume,
 case when ap.periodo is not null then coalesce(p.rate,0) end as mom_rate,
 m.periodo is null as is_absent_current,
 coalesce(m.reported_well_rows,0) as reported_well_rows,
 coalesce(m.valid_volume_rows,0) as valid_volume_rows,
 coalesce(m.positive_producing_wells,0) as positive_producing_wells,
 coalesce(m.located_well_rows,0) as located_well_rows,
 coalesce(m.missing_catalog_well_rows,0) as missing_catalog_well_rows,
 coalesce(m.invalid_coordinate_well_rows,0) as invalid_coordinate_well_rows,
 coalesce(m.located_positive_wells,0) as located_positive_wells,
 coalesce(m.unlocated_positive_wells,0) as unlocated_positive_wells,
 m.coordinate_coverage,m.positive_coordinate_coverage,
 coalesce(m.missing_area_well_rows,0) as missing_area_well_rows,
 coalesce(m.missing_area_ids,0) as missing_area_ids
 from universe u join names n on n.operator_group_id=u.operator_group_id and n.area_id=u.area_id
 left join monthly m on m.fluid=u.fluid and m.periodo=u.periodo and m.operator_group_id=u.operator_group_id and m.area_id=u.area_id
 left join accepted ay on ay.periodo={{ publication_shift('u.periodo',-12) }}
 left join accepted ap on ap.periodo={{ publication_shift('u.periodo',-1) }}
 left join monthly y on y.fluid=u.fluid and y.periodo=ay.periodo and y.operator_group_id=u.operator_group_id and y.area_id=u.area_id
 left join monthly p on p.fluid=u.fluid and p.periodo=ap.periodo and p.operator_group_id=u.operator_group_id and p.area_id=u.area_id
)
select *,volume-yoy_volume as yoy_volume_delta,rate-yoy_rate as yoy_rate_delta,
 volume-mom_volume as mom_volume_delta,rate-mom_rate as mom_rate_delta,
 100.0*(volume-yoy_volume)/nullif(yoy_volume,0) as yoy_volume_pct,
 100.0*(rate-yoy_rate)/nullif(yoy_rate,0) as yoy_rate_pct,
 100.0*(volume-mom_volume)/nullif(mom_volume,0) as mom_volume_pct,
 100.0*(rate-mom_rate)/nullif(mom_rate,0) as mom_rate_pct,
 100.0*volume/nullif(sum(volume) over(partition by fluid,periodo,operator_group_id),0) as operator_volume_share_pct
from compared
{% endmacro %}
