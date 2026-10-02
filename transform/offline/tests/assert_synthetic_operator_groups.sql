-- Prior legal pct changes are 200% and 0%; group change must be 20%, never 100%.
with e as (select * from {{ ref('fct_entity_growth') }} where dimension='company'),
t as (select * from {{ ref('fct_production_month') }})
select 'aggregate_before_percentage' as failure where not exists (
 select 1 from e where fluid='gas' and entity_id='PLUSPETROL' and periodo=date '2024-04-01'
 and abs(volume-1.2)<1e-10 and abs(yoy_volume-1.0)<1e-10
 and abs(yoy_volume_pct-20.0)<1e-8 and abs(rate-1.2/30)<1e-10
 and abs(yoy_rate_pct-20.0)<1e-8 and volume_rank=1
 and positive_producing_wells=2 and reported_well_rows=2 and valid_volume_rows=2
 and entity_name='Pluspetrol' and operator_group_rule_version='estrato-operator-groups-v1'
 and array_length(legal_operator_provenance)=2
)
union all select 'oil_group_sum' where not exists (
 select 1 from e where fluid='oil' and entity_id='PLUSPETROL' and periodo=date '2024-04-01'
 and abs(volume-120*6.28981077)<1e-8 and abs(yoy_volume-100*6.28981077)<1e-8
 and abs(yoy_volume_pct-20)<1e-8
)
union all select 'no_legal_duplicates' where exists (
 select 1 from e where entity_id in ('PCN','PLU')
)
union all select 'group_top5_and_total_consistency' where not exists (
 select 1 from t where fluid='gas' and periodo=date '2024-04-01'
 and abs(volume-6.9)<1e-10 and abs(top5_company_share_pct-100.0*500/690)<1e-8
 and abs(yoy_top5_company_share_pct-100.0*480/670)<1e-8
 and abs(top5_company_share_yoy_pp-(100.0*500/690-100.0*480/670))<1e-8
)
union all select 'legal_rank_would_differ' where not exists (
 select 1 from e where fluid='gas' and periodo=date '2023-04-01'
 and entity_id='PLUSPETROL' and volume_rank=2
)
union all select 'name_matching_forbidden' where not exists (
 select 1 from e where fluid='gas' and periodo=date '2023-04-01' and entity_id='UNM'
 and entity_name='Unknown source Pluspetrol name' and operator_group_rule_version is null
)
union all select 'no_acquired_vendor_restatement' where not exists (
 select 1 from e where fluid='gas' and periodo=date '2023-04-01' and entity_id='EXX'
 and abs(volume-0.4)<1e-10 and operator_group_rule_version is null
)
union all select 'missing_calendar_group' where not exists (
 select 1 from e where fluid='gas' and periodo=date '2023-04-01' and entity_id='PLUSPETROL'
 and yoy_volume is null and yoy_volume_pct is null
)
union all select 'zero_group_base' where not exists (
 select 1 from e where fluid='gas' and periodo=date '2024-04-01' and entity_id='PLUSPETROL'
 and mom_volume=0 and mom_volume_pct is null and abs(mom_volume_delta-1.2)<1e-10
)
union all select 'legal_provenance' where not exists (
 select 1 from e, unnest(legal_operator_provenance) p(legal)
 where fluid='gas' and periodo=date '2024-04-01' and entity_id='PLUSPETROL'
 and legal.idempresa='PCN' and legal.empresa='PCN legal name'
)
