select 'historical_attrs' as issue from {{ ref('fct_well_activity_month') }} where sigla!='PROD' or tipoestado!='production_status' or tipopozo!='production_type'
union all
select 'missing_coordinate_retained' where (select count(*) from {{ ref('fct_well_activity_month') }} where idpozo=3 and not coordinate_valid and coordinate_issue='missing_catalog_id' and not positive_production)!=2
union all
select 'invalid_coordinate_retained' where (select count(*) from {{ ref('fct_well_activity_month') }} where idpozo=2 and catalog_present and not coordinate_valid and coordinate_issue='invalid_coordinate')!=6
union all
select 'catalog_date_separate' where (select count(*) from {{ ref('fct_well_activity_month') }} where idpozo=1 and cast(catalog_at as date)=cast('2026-07-08' as date) and periodo<cast(catalog_at as date))!=6
union all
select 'mapped_legal_ids' where (select count(distinct legal_operator_id) from {{ ref('fct_well_activity_month') }} where operator_group_id='PLUSPETROL')!=2
union all
select 'sum_before_growth' from {{ ref('fct_operator_area_month') }} where operator_group_id='PLUSPETROL' and periodo=cast('2024-04-01' as date) and abs(yoy_volume_pct-20)>0.000001
union all
select 'zero_comparator' from {{ ref('fct_operator_area_month') }} where operator_group_id='PLUSPETROL' and periodo=cast('2024-03-01' as date) and (yoy_volume!=0 or yoy_volume_pct is not null)
union all
select 'missing_area_preserved' where not exists(select 1 from {{ ref('fct_well_activity_month') }} where area_id='Y' and not area_geometry_available)
