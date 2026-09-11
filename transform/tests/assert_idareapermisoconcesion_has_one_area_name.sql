-- Fails if one idareapermisoconcesion maps to more than one area name
-- in the Pulse well-month cut. dim_area uses any_value(areapermisoconcesion).

select idareapermisoconcesion
from {{ ref("fct_well_month") }}
group by 1
having count(distinct areapermisoconcesion) > 1
