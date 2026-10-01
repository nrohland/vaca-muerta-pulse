{% macro generate_schema_name(custom_schema_name, node) -%}
    {# Candidate layers are isolated by a validated opt-in suffix.
       Empty suffix preserves existing dev/prod dataset names exactly.
       Raw dataset remains controlled independently by DBT_RAW_DATASET. #}
    {%- set suffix = env_var('DBT_CANDIDATE_SUFFIX', '') -%}
    {%- if suffix and not modules.re.fullmatch('[a-zA-Z0-9_]+', suffix) -%}
        {{ exceptions.raise_compiler_error('DBT_CANDIDATE_SUFFIX must contain only a-z, A-Z, 0-9 or underscore') }}
    {%- endif -%}
    {%- set is_prod = target.name == 'prod' -%}
    {%- if custom_schema_name in ['stg', 'int', 'marts'] -%}
        {%- set base = custom_schema_name ~ '_cap4' ~ ('' if is_prod else '_dev') -%}
        {{ base ~ ('_' ~ suffix if suffix else '') }}
    {%- elif custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
