{% macro m3_to_bbl(m3_expr) -%}
    {# Factor is var('m3_to_bbl') = 6.28981077. Same number in _metrics.yml. #}
    (({{ m3_expr }}) * {{ var('m3_to_bbl') }})
{%- endmacro %}
