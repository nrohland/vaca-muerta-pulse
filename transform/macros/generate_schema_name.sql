{% macro generate_schema_name(custom_schema_name, node) -%}
    {# Custom schemas are real BQ datasets, not target_schema_custom. #}
    {%- set is_prod = target.name == 'prod' -%}
    {%- if custom_schema_name == 'stg' -%}
        {{ 'stg_cap4' if is_prod else 'stg_cap4_dev' }}
    {%- elif custom_schema_name == 'int' -%}
        {{ 'int_cap4' if is_prod else 'int_cap4_dev' }}
    {%- elif custom_schema_name == 'marts' -%}
        {{ 'marts' if is_prod else 'marts_dev' }}
    {%- elif custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
