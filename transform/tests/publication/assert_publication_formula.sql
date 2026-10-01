-- Verify business measures independently on output, inside dbt.
{% for model in ['fct_production_month','fct_entity_growth'] %}
select fluid,periodo from {{ ref(model) }}
where abs(rate - volume / {{ cap4_days_in_month('periodo') }}) > 1e-8 * greatest(1,abs(rate))
{% for comparator,months in [('yoy',-12),('mom',-1)] %}
 or abs({{ comparator }}_rate - {{ comparator }}_volume / {{ cap4_days_in_month(publication_shift('periodo',months)) }}) > 1e-8 * greatest(1,abs({{ comparator }}_rate))
 or ({{ comparator }}_volume is null) <> ({{ comparator }}_volume_delta is null)
 or ({{ comparator }}_rate is null) <> ({{ comparator }}_rate_delta is null)
 or abs({{ comparator }}_volume_delta - (volume-{{ comparator }}_volume)) > 1e-8 * greatest(1,abs({{ comparator }}_volume_delta))
 or abs({{ comparator }}_rate_delta - (rate-{{ comparator }}_rate)) > 1e-8 * greatest(1,abs({{ comparator }}_rate_delta))
 or ({{ comparator }}_volume is null or {{ comparator }}_volume=0) <> ({{ comparator }}_volume_pct is null)
 or ({{ comparator }}_rate is null or {{ comparator }}_rate=0) <> ({{ comparator }}_rate_pct is null)
 or abs({{ comparator }}_volume_pct - (volume-{{ comparator }}_volume)/nullif({{ comparator }}_volume,0)*100) > 1e-8 * greatest(1,abs({{ comparator }}_volume_pct))
 or abs({{ comparator }}_rate_pct - (rate-{{ comparator }}_rate)/nullif({{ comparator }}_rate,0)*100) > 1e-8 * greatest(1,abs({{ comparator }}_rate_pct))
{% endfor %}
{% if not loop.last %} union all {% endif %}
{% endfor %}
