{% macro publication_shift(column, months) %}
{% if target.type == 'bigquery' %}date_add({{ column }}, interval {{ months }} month){% else %}cast({{ column }} + interval '{{ months }} month' as date){% endif %}
{% endmacro %}

{% macro publication_input() %}
{% if target.type == 'duckdb' %}{{ ref('synthetic_well_month') }}{% else %}{{ ref('fct_well_month') }}{% endif %}
{% endmacro %}

{% macro publication_base() %}
{% set approved = var('approved_period', '') %}
{% set accepted = var('accepted_periods', []) %}
{% if not approved or not accepted %}
{% if execute %}{{ exceptions.raise_compiler_error('Publication requires approved_period and explicit accepted_periods complete snapshots') }}{% endif %}
{% set approved = '0001-01-01' %}{% set accepted = ['0001-01-01'] %}
{% endif %}
{% if approved not in accepted or accepted|length != accepted|unique|list|length %}{{ exceptions.raise_compiler_error('Approved period must be explicitly accepted; duplicate acceptance months forbidden') }}{% endif %}
{% for p in accepted + [approved] %}
{% if not modules.re.match('^[0-9]{4}-(0[1-9]|1[0-2])-01$', p) %}{{ exceptions.raise_compiler_error('Invalid publication month: ' ~ p) }}{% endif %}
{% if p > approved %}{{ exceptions.raise_compiler_error('Accepted month exceeds approved cutoff') }}{% endif %}
{% set checked_date = modules.datetime.datetime.strptime(p, '%Y-%m-%d') %}
{% endfor %}
wells as (select * from {{ publication_input() }}),
accepted as (
 select distinct periodo from wells
 where periodo <= cast('{{ approved }}' as date)
 and periodo in ({% for p in accepted %}cast('{{ p }}' as date){% if not loop.last %},{% endif %}{% endfor %})
),
fluids as (
 select w.*, 'oil' as fluid, prod_pet_m3 * {{ var('m3_to_bbl', 6.28981077) }} as volume, 'bbl' as volume_unit
 from wells w join accepted a on w.periodo=a.periodo
 union all
 select w.*, 'gas' as fluid, prod_gas_km3 / 1000.0 as volume, 'million_m3' as volume_unit
 from wells w join accepted a on w.periodo=a.periodo
)
{% endmacro %}

{% macro publication_growth_columns() %}
{% for c in ['yoy','mom'] %}
{{ c }}_volume,
{{ c }}_rate,
volume - {{ c }}_volume as {{ c }}_volume_delta,
rate - {{ c }}_rate as {{ c }}_rate_delta,
(volume - {{ c }}_volume) / nullif({{ c }}_volume, 0) * 100.0 as {{ c }}_volume_pct,
(rate - {{ c }}_rate) / nullif({{ c }}_rate, 0) * 100.0 as {{ c }}_rate_pct,
{% endfor %}
{% endmacro %}

{% macro publication_total() %}
with {{ publication_base() }},
{{ publication_concentration() }},
monthly as (
 select fluid, periodo, volume_unit, sum(volume) as volume,
 sum(volume) / {{ cap4_days_in_month('periodo') }} as rate,
 {{ cap4_days_in_month('periodo') }} as days_in_month,
 count(distinct case when volume > 0 then idpozo end) as positive_producing_wells,
 count(*) as reported_well_rows, count(volume) as valid_volume_rows,
 max(source_batched_at) as source_loaded_at
 from fluids group by fluid, periodo, volume_unit
), compared as (
 select m.*, y.volume as yoy_volume, y.rate as yoy_rate,
 p.volume as mom_volume, p.rate as mom_rate,
 cc.top5_share_pct as top5_company_share_pct, cy.top5_share_pct as yoy_top5_company_share_pct,
 cc.top5_share_pct-cy.top5_share_pct as top5_company_share_yoy_pp,
 ac.top5_share_pct as top5_area_share_pct, ay.top5_share_pct as yoy_top5_area_share_pct,
 ac.top5_share_pct-ay.top5_share_pct as top5_area_share_yoy_pp
 from monthly m
 left join concentration cc on cc.fluid=m.fluid and cc.periodo=m.periodo and cc.dimension='company'
 left join concentration cy on cy.fluid=m.fluid and cy.periodo={{ publication_shift('m.periodo',-12) }} and cy.dimension='company'
 left join concentration ac on ac.fluid=m.fluid and ac.periodo=m.periodo and ac.dimension='area'
 left join concentration ay on ay.fluid=m.fluid and ay.periodo={{ publication_shift('m.periodo',-12) }} and ay.dimension='area' 
 left join monthly y on m.fluid=y.fluid and y.periodo={{ publication_shift('m.periodo', -12) }}
 left join monthly p on m.fluid=p.fluid and p.periodo={{ publication_shift('m.periodo', -1) }}
)
select fluid, periodo, volume_unit, volume, rate, days_in_month,
 {{ publication_growth_columns() }}
 top5_company_share_pct,yoy_top5_company_share_pct,top5_company_share_yoy_pp,
 top5_area_share_pct,yoy_top5_area_share_pct,top5_area_share_yoy_pp,
 positive_producing_wells, reported_well_rows, valid_volume_rows,
 1.0 * valid_volume_rows / nullif(reported_well_rows,0) as coverage,
 true as is_complete, 'approved_complete_snapshot' as acceptance_basis,
 source_loaded_at
from compared
{% endmacro %}

{% macro publication_entity() %}
with {{ publication_base() }},
{{ publication_concentration() }},
entity_rows as (
 select fluid, periodo, volume_unit, 'company' as dimension,
 cast(idempresa as {{ dbt.type_string() }}) as entity_id, empresa as source_name,
 idpozo, volume from fluids
 union all
 select fluid, periodo, volume_unit, 'area' as dimension,
 cast(idareapermisoconcesion as {{ dbt.type_string() }}), areapermisoconcesion,
 idpozo, volume from fluids
), names as (
 select dimension, entity_id, source_name as entity_name, periodo as name_periodo
 from entity_rows
 qualify row_number() over(partition by dimension,entity_id order by periodo desc, source_name desc)=1
), monthly as (
 select fluid, dimension, entity_id, periodo, volume_unit, min(source_name) as source_name,
 sum(volume) as volume,
 count(distinct case when volume>0 then idpozo end) as positive_producing_wells,
 count(*) as reported_well_rows, count(volume) as valid_volume_rows
 from entity_rows group by fluid, dimension, entity_id, periodo, volume_unit
), universe as (
 select fluid, dimension, entity_id, periodo, volume_unit from monthly
 union distinct
 select m.fluid,m.dimension,m.entity_id,a.periodo,m.volume_unit from monthly m
 join accepted a on m.periodo={{ publication_shift('a.periodo', -12) }} or m.periodo={{ publication_shift('a.periodo', -1) }}
), compared as (
 select u.*, n.entity_name,n.name_periodo,m.source_name,
 coalesce(m.volume,0) as volume,
 coalesce(m.volume,0) / {{ cap4_days_in_month('u.periodo') }} as rate,
 case when ay.periodo is not null then coalesce(y.volume,0) end as yoy_volume,
 case when ay.periodo is not null then coalesce(y.volume,0)/{{ cap4_days_in_month('ay.periodo') }} end as yoy_rate,
 case when ap.periodo is not null then coalesce(p.volume,0) end as mom_volume,
 case when ap.periodo is not null then coalesce(p.volume,0)/{{ cap4_days_in_month('ap.periodo') }} end as mom_rate,
 coalesce(m.positive_producing_wells,0) as positive_producing_wells,
 coalesce(m.reported_well_rows,0) as reported_well_rows,
 coalesce(m.valid_volume_rows,0) as valid_volume_rows,
 m.periodo is null as is_absent_current,
 cc.top5_share_pct as top5_share_pct,cy.top5_share_pct as yoy_top5_share_pct,
 cc.top5_share_pct-cy.top5_share_pct as top5_share_yoy_pp
 from universe u
 left join concentration cc on cc.fluid=u.fluid and cc.dimension=u.dimension and cc.periodo=u.periodo
 left join concentration cy on cy.fluid=u.fluid and cy.dimension=u.dimension and cy.periodo={{ publication_shift('u.periodo',-12) }}
 join names n on u.dimension=n.dimension and u.entity_id=n.entity_id
 left join monthly m on u.fluid=m.fluid and u.dimension=m.dimension and u.entity_id=m.entity_id and u.periodo=m.periodo
 left join accepted ay on ay.periodo={{ publication_shift('u.periodo',-12) }}
 left join accepted ap on ap.periodo={{ publication_shift('u.periodo',-1) }}
 left join monthly y on u.fluid=y.fluid and u.dimension=y.dimension and u.entity_id=y.entity_id and y.periodo=ay.periodo
 left join monthly p on u.fluid=p.fluid and u.dimension=p.dimension and u.entity_id=p.entity_id and p.periodo=ap.periodo
) , growth as (
 select *, rate-yoy_rate as yoy_rate_delta from compared
), ranked as (
 select *, row_number() over(partition by fluid,dimension,periodo order by volume desc,entity_id) as volume_rank,
 row_number() over(partition by fluid,dimension,periodo order by yoy_rate_delta desc,entity_id) as positive_contribution_rank,
 row_number() over(partition by fluid,dimension,periodo order by yoy_rate_delta asc nulls last,entity_id) as negative_contribution_rank
 from growth
), selected as (
 select *, coalesce((yoy_rate_delta>0 and positive_contribution_rank<=5) or (yoy_rate_delta<0 and negative_contribution_rank<=5),false) as yoy_contribution_selected from ranked
)
select fluid,dimension,entity_id,periodo,volume_unit,entity_name,name_periodo,source_name,
 volume,rate, {{ publication_growth_columns() }}
 volume_rank,top5_share_pct,yoy_top5_share_pct,top5_share_yoy_pp,yoy_contribution_selected,
 sum(case when not yoy_contribution_selected then yoy_rate_delta else 0 end) over(partition by fluid,dimension,periodo) as yoy_rest_rate_delta,
 positive_producing_wells,reported_well_rows,valid_volume_rows,is_absent_current,
 case when reported_well_rows=0 then 1.0 else 1.0*valid_volume_rows/reported_well_rows end as coverage,
 true as is_complete, 'approved_complete_snapshot' as acceptance_basis
from selected
{% endmacro %}

{% macro publication_concentration() %}
concentration_entities as (
 select fluid,periodo,'company' as dimension,cast(idempresa as {{ dbt.type_string() }}) as entity_id,sum(volume) as volume from fluids group by fluid,periodo,idempresa
 union all
 select fluid,periodo,'area',cast(idareapermisoconcesion as {{ dbt.type_string() }}),sum(volume) from fluids group by fluid,periodo,idareapermisoconcesion
), concentration_ranked as (
 select *,row_number() over(partition by fluid,periodo,dimension order by volume desc,entity_id) as rank from concentration_entities
), concentration as (
 select fluid,periodo,dimension,100.0*sum(case when rank<=5 then volume else 0 end)/nullif(sum(volume),0) as top5_share_pct
 from concentration_ranked group by fluid,periodo,dimension
)
{% endmacro %}

{% macro publication_finite(column) %}
{% if target.type == 'bigquery' %}(not is_inf(cast({{ column }} as float64)) and not is_nan(cast({{ column }} as float64))){% else %}isfinite({{ column }}){% endif %}
{% endmacro %}
