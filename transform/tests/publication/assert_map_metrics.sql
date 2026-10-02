{% set counts = ['reported_well_rows','valid_volume_rows','positive_producing_wells','located_well_rows','missing_catalog_well_rows','invalid_coordinate_well_rows','located_positive_wells','unlocated_positive_wells','missing_area_well_rows','missing_area_ids'] %}
{% set measures = ['volume','rate','coordinate_coverage','positive_coordinate_coverage'] %}
with expected_detail as ({{ operator_area_month() }}),
expected_global as ({{ map_coverage_month() }})
select 'detail_metrics' as issue from {{ ref('fct_operator_area_month') }} d
full outer join expected_detail e on e.fluid=d.fluid and e.periodo=d.periodo and e.operator_group_id=d.operator_group_id and e.area_id=d.area_id
where d.fluid is null or e.fluid is null or d.is_absent_current is null or d.is_absent_current!=e.is_absent_current
 {% for c in counts %}or d.{{c}} is null or d.{{c}}!=e.{{c}} or d.{{c}}<0 {% endfor %}
 {% for c in measures + ['operator_volume_share_pct','yoy_volume','yoy_rate','mom_volume','mom_rate','yoy_volume_delta','yoy_rate_delta','mom_volume_delta','mom_rate_delta','yoy_volume_pct','yoy_rate_pct','mom_volume_pct','mom_rate_pct'] %}
 or (d.{{c}} is null)!=(e.{{c}} is null)
 or (d.{{c}} is not null and (not {{ publication_finite('d.' ~ c) }} or abs(d.{{c}}-e.{{c}})>greatest(1e-6,abs(e.{{c}})*1e-9)))
 {% endfor %}
union all
select 'global_coverage_metrics' from {{ ref('fct_map_coverage_month') }} d
full outer join expected_global e on e.fluid=d.fluid and e.periodo=d.periodo
where e.fluid is null or d.fluid is null
 {% for c in counts %}or d.{{c}} is null or d.{{c}}!=e.{{c}} or d.{{c}}<0 {% endfor %}
 {% for c in measures %}
 or (d.{{c}} is null)!=(e.{{c}} is null)
 or (d.{{c}} is not null and (not {{ publication_finite('d.' ~ c) }} or abs(d.{{c}}-e.{{c}})>greatest(1e-6,abs(e.{{c}})*1e-9)))
 {% endfor %}
