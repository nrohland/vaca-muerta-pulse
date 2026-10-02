-- Mapping may never duplicate legal well rows or silently expand ownership history.
with mapping as (select * from {{ ref('operator_groups') }}),
overlapping_windows as (
 select a.legal_operator_id from mapping a join mapping b
 on a.legal_operator_id=b.legal_operator_id and a.valid_from<b.valid_from
 and (a.valid_to is null or a.valid_to>b.valid_from)
)
select legal_operator_id as failure from mapping
where legal_operator_id not in ('PCN','PLU') or operator_group_id<>'PLUSPETROL'
 or operator_group_name<>'Pluspetrol' or valid_from<>date '2023-01-01'
 or valid_to is not null or rule_version<>'estrato-operator-groups-v1'
 or grouping_basis<>'reviewed_explicit_id_mapping'
 or history_policy<>'presentation_constant_from_2023_01_no_acquired_vendor_restatement'
union all select legal_operator_id from mapping group by legal_operator_id having count(*)<>1
union all select legal_operator_id from overlapping_windows
union all select 'missing_mapping' from (select 1 as guard) g
where (select count(*) from mapping)<>2
