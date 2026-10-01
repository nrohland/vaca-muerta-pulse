{{ config(materialized='table', tags=['publication']) }}
{{ publication_entity() }}
