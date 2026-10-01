with wells as (select * from {{ publication_input() }})
select cast(idpozo as {{ dbt.type_string() }}) as bad_key from wells
where prod_pet_m3 is null or prod_gas_km3 is null or prod_pet_m3<0 or prod_gas_km3<0
 or idempresa is null or idareapermisoconcesion is null
 or empresa is null or trim(empresa)='' or areapermisoconcesion is null or trim(areapermisoconcesion)=''
 or not {{ publication_finite('prod_pet_m3') }} or not {{ publication_finite('prod_gas_km3') }}
union all
select cast(idpozo as {{ dbt.type_string() }}) from wells group by idpozo,periodo having count(*)>1
union all
select cast(idempresa as {{ dbt.type_string() }}) from wells group by idempresa,periodo having count(distinct empresa)>1
union all
select cast(idareapermisoconcesion as {{ dbt.type_string() }}) from wells group by idareapermisoconcesion,periodo having count(distinct areapermisoconcesion)>1
union all
select 'missing_approved_period' where not exists (
 select 1 from {{ ref('fct_production_month') }} where periodo=cast('{{ var("approved_period", "0001-01-01") }}' as date)
)
{% for p in var('accepted_periods', []) %}
union all
select 'missing_accepted_period' where not exists (select 1 from wells where periodo=cast('{{ p }}' as date))
{% endfor %}
