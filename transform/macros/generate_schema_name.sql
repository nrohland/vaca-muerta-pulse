{% macro generate_schema_name(custom_schema_name, node) -%}
    {# Dedicated BQ datasets (Nicolás / DE). Not `{profile}_{custom}`.
       Dev (default): stg_cap4_dev / int_cap4_dev / marts_cap4_dev
       Prod twin (target prod): stg_cap4 / int_cap4 / marts_cap4
    #}
    {%- set is_prod = target.name == 'prod' -%}
    {%- if custom_schema_name == 'stg' -%}
        {{ 'stg_cap4' if is_prod else 'stg_cap4_dev' }}
    {%- elif custom_schema_name == 'int' -%}
        {{ 'int_cap4' if is_prod else 'int_cap4_dev' }}
    {%- elif custom_schema_name == 'marts' -%}
        {{ 'marts_cap4' if is_prod else 'marts_cap4_dev' }}
    {%- elif custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
