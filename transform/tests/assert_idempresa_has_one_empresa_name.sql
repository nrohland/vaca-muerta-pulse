-- Legitimate historical renames allowed; conflicting same-month identity fails.
select idempresa,periodo from {{ ref('fct_well_month') }}
group by idempresa,periodo having count(distinct empresa)>1
