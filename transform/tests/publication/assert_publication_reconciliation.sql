with entities as (
 select fluid,dimension,periodo,
 {% for c in ['volume','rate','yoy_volume','yoy_rate','mom_volume','mom_rate','yoy_volume_delta','yoy_rate_delta','mom_volume_delta','mom_rate_delta'] %}
 sum({{ c }}) as {{ c }}{% if not loop.last %},{% endif %}
 {% endfor %}
 from {{ ref('fct_entity_growth') }} group by fluid,dimension,periodo
)
select e.fluid,e.dimension,e.periodo from entities e
join {{ ref('fct_production_month') }} t on e.fluid=t.fluid and e.periodo=t.periodo
where {% for c in ['volume','rate','yoy_volume','yoy_rate','mom_volume','mom_rate','yoy_volume_delta','yoy_rate_delta','mom_volume_delta','mom_rate_delta'] %}
(e.{{ c }} is null) <> (t.{{ c }} is null) or abs(e.{{ c }} - t.{{ c }}) > 0.000001 * greatest(1,abs(t.{{ c }})){% if not loop.last %} or {% endif %}
{% endfor %}
