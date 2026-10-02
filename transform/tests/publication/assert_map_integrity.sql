select 'invalid_activity' as issue from {{ ref('fct_well_activity_month') }}
where idpozo is null or legal_operator_id is null or operator_group_id is null or area_id is null
 or volume is null or volume<0 or rate is null or rate<0
 or not {{ publication_finite('volume') }} or not {{ publication_finite('rate') }}
 or lower(cuenca)!='neuquina' or cuenca is null
 or coordinate_valid is null or positive_production is null or positive_production != (volume>0)
 or (coordinate_valid and (longitude is null or latitude is null or longitude not between -180 and 180 or latitude not between -90 and 90 or longitude=0 or latitude=0 or catalog_at is null or geo_source_resource_id is null))
 or (not coordinate_valid and (longitude is not null or latitude is not null or coordinate_issue is null))
 or (legal_operator_id in ('PCN','PLU') and periodo>=cast('2023-01-01' as date) and operator_group_id!='PLUSPETROL')
union all
select 'invalid_coverage' from {{ ref('fct_map_coverage_month') }}
where located_well_rows+missing_catalog_well_rows+invalid_coordinate_well_rows!=reported_well_rows
 or located_positive_wells+unlocated_positive_wells!=positive_producing_wells
 or coordinate_coverage<0 or coordinate_coverage>1
 or missing_area_well_rows<0 or missing_area_well_rows>reported_well_rows
union all
select 'invalid_activity_rate' from {{ ref('fct_well_activity_month') }}
where abs(rate-volume/{{ cap4_days_in_month('periodo') }})>greatest(1e-6,abs(rate)*1e-9)
 or catalog_present is null or area_geometry_available is null
