select fluid from {{ ref('fct_production_month') }} group by fluid,periodo having count(*)>1
union all
select fluid from {{ ref('fct_entity_growth') }} group by fluid,dimension,entity_id,periodo having count(*)>1
union all
select fluid from {{ ref('fct_production_month') }} where coverage<>1 or volume<0 or rate<0
union all
select fluid from {{ ref('fct_entity_growth') }} where coverage<>1 or volume<0 or rate<0
