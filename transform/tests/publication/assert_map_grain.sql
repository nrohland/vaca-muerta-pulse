select 'activity' as issue from {{ ref('fct_well_activity_month') }} group by fluid,periodo,idpozo having count(*)!=1
union all
select 'operator_area' from {{ ref('fct_operator_area_month') }} group by fluid,periodo,operator_group_id,area_id having count(*)!=1
union all
select 'coverage' from {{ ref('fct_map_coverage_month') }} group by fluid,periodo having count(*)!=1
union all
select 'catalog_fanout' from {{ activity_geo_input() }} group by idpozo having count(*)!=1 or idpozo is null
union all
select 'area_fanout' from {{ activity_area_input() }} group by area_id having count(*)!=1 or area_id is null
