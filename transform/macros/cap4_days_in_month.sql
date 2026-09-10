{% macro cap4_days_in_month(date_column) -%}
    {{ return(adapter.dispatch('cap4_days_in_month')(date_column)) }}
{%- endmacro %}

{% macro default__cap4_days_in_month(date_column) -%}
    extract(day from last_day({{ date_column }}))
{%- endmacro %}

{% macro bigquery__cap4_days_in_month(date_column) -%}
    {# Calendar days of `periodo` (DATE YYYY-MM-01). Cheap vs a dbt_date spine. #}
    extract(day from last_day({{ date_column }}))
{%- endmacro %}
