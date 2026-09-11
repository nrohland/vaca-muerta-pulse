-- Fails if one idempresa maps to more than one empresa string in the
-- Pulse well-month cut. dim_company uses any_value(empresa); this test
-- is the grain guard.

select idempresa
from {{ ref("fct_well_month") }}
group by 1
having count(distinct empresa) > 1
