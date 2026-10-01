-- Synthetic dbt regression: leap year, missing exact calendar base, base-zero,
-- full entry/exit universe, approved cutoff, and historical name trace.
with t as (select * from {{ ref('fct_production_month') }} where fluid='gas'),
e as (select * from {{ ref('fct_entity_growth') }} where fluid='gas' and dimension='company')
select 'leap' as failure where not exists(select 1 from t where periodo=date '2024-02-01' and days_in_month=29 and abs(rate-0.1)<1e-10 and abs(yoy_rate-0.1)<1e-10)
union all select 'missing_month' where not exists(select 1 from t where periodo=date '2024-01-01' and yoy_volume is null and mom_volume is null)
union all select 'zero_base_entry' where not exists(select 1 from e where periodo=date '2024-02-01' and entity_id='B' and yoy_volume=0 and yoy_volume_pct is null and yoy_volume_delta=2.9)
union all select 'exit' where not exists(select 1 from e where periodo=date '2024-02-01' and entity_id='A' and volume=0 and yoy_volume_delta=-2.8 and yoy_volume_pct=-100 and is_absent_current)
union all select 'entry' where not exists(select 1 from e where periodo=date '2024-03-01' and entity_id='A' and mom_volume=0 and mom_volume_delta=6.2)
union all select 'rename_trace' where not exists(select 1 from e where periodo=date '2023-02-01' and entity_id='A' and entity_name='New A' and source_name='Old A' and name_periodo=date '2024-03-01')
union all select 'unapproved' where exists(select 1 from t where periodo>date '2024-05-01')
union all select 'zero_wells' where not exists(select 1 from e where entity_id='C' and periodo=date '2024-02-01' and positive_producing_wells=0)

union all select 'top5_concentration' where not exists(select 1 from t where periodo=date '2024-05-01' and abs(top5_company_share_pct-100.0*5/7)<1e-8 and abs(top5_company_share_yoy_pp)<1e-8)
union all select 'signed_rest' where not exists(select 1 from e where periodo=date '2024-05-01' group by periodo having sum(case when yoy_contribution_selected then 1 else 0 end)=10 and abs(max(yoy_rest_rate_delta)-2.0/31)<1e-8)
union all select 'rank_tie' where not exists(select 1 from e where periodo=date '2024-05-01' and entity_id='P1' and volume_rank=1)
