select idareapermisoconcesion,periodo from {{ ref('fct_well_month') }}
group by idareapermisoconcesion,periodo having count(distinct areapermisoconcesion)>1
