"""Validate exported dbt rows and write an immutable candidate, never approve it.

No unit conversion, rates, growth, rankings or other business calculations here.
Summation is only for validating reconciliation of already computed dbt measures.
"""
import argparse
import csv
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

MEASURES = ('volume', 'rate', 'yoy_volume', 'yoy_rate', 'mom_volume', 'mom_rate',
            'yoy_volume_delta', 'yoy_rate_delta', 'mom_volume_delta', 'mom_rate_delta')
PCTS = ('yoy_volume_pct', 'yoy_rate_pct', 'mom_volume_pct', 'mom_rate_pct')


def read_json(path):
    return json.loads(Path(path).read_text(), parse_constant=lambda x: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def operator_group_definition():
    seed = Path(__file__).resolve().parents[1] / 'seeds/operator_groups.csv'
    with seed.open(newline='') as file:
        mappings = list(csv.DictReader(file))
    return {'rule_version': 'estrato-operator-groups-v1',
            'semantics': 'constant presentation mapping from 2023-01; no acquired-vendor historical restatement',
            'seed_sha256': hashlib.sha256(seed.read_bytes()).hexdigest(),
            'mappings': mappings,
            'unknown_id_policy': 'preserve source ID and declared legal name',
            'legal_provenance_field': 'legal_operator_provenance'}


def validate_rows(totals, entities, source):
    grouped = ['operator_group_rule_version' in row for row in entities]
    require(not grouped or all(grouped) or not any(grouped), 'Mixed operator grouping contracts')
    require(source.get('data_kind') == 'official', 'Synthetic data cannot become a release')
    approved = source['approved_period']
    accepted = set(source['accepted_periods'])
    for p in accepted | {approved}:
        require(re.fullmatch(r'\d{4}-\d{2}-01', p) is not None, 'Month must be YYYY-MM-01')
        datetime.strptime(p, '%Y-%m-%d')
    require(len(accepted) == len(source['accepted_periods']), 'Duplicate accepted months')
    require(approved in accepted and max(accepted) == approved, 'Approved period must match acceptance list cutoff')
    require(source.get('resources') and source.get('commit') and source.get('accepted_at'), 'Source provenance required')
    for resource in source['resources']:
        require(resource.get('id') and resource.get('url', '').startswith('https://'), 'Official resource identity required')
        require(resource.get('sha256') or resource.get('hash_unavailable_reason'), 'Record source hash or explicit unavailable reason')
        if resource.get('sha256'):
            require(re.fullmatch(r'[a-fA-F0-9]{64}', resource['sha256']) is not None, 'Invalid resource SHA256')
    require(totals and entities, 'Empty release')
    total_keys = set()
    entity_keys = set()
    groups = {}
    for rows, is_entity in ((totals, False), (entities, True)):
        for row in rows:
            require(row['fluid'] in ('oil', 'gas') and row['periodo'] in accepted, 'Unexpected fluid or period')
            require(row['volume_unit'] == ('bbl' if row['fluid'] == 'oil' else 'million_m3'), 'Wrong fluid unit')
            require(row['is_complete'] is True and not isinstance(row['coverage'], bool) and row['coverage'] == 1, 'Incomplete month')
            require(row['acceptance_basis'] == 'approved_complete_snapshot', 'Missing snapshot acceptance')
            for key in MEASURES + PCTS + (('top5_share_pct', 'yoy_top5_share_pct', 'top5_share_yoy_pp', 'yoy_rest_rate_delta') if is_entity else ('top5_company_share_pct', 'yoy_top5_company_share_pct', 'top5_company_share_yoy_pp', 'top5_area_share_pct', 'yoy_top5_area_share_pct', 'top5_area_share_yoy_pp')):
                v = row[key]
                require(v is None or (isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)), 'Invalid measure: ' + key)
            require(row['volume'] is not None and row['volume'] >= 0 and row['rate'] is not None and row['rate'] >= 0, 'Invalid current volume/rate')
            require(isinstance(row['positive_producing_wells'], int) and not isinstance(row['positive_producing_wells'], bool) and row['positive_producing_wells'] >= 0, 'Invalid producing wells')
            if is_entity:
                require(row['dimension'] in ('company', 'area') and row['entity_id'] and row['entity_name'], 'Invalid entity')
                if 'operator_group_rule_version' in row:
                    provenance = row.get('legal_operator_provenance')
                    if row['dimension'] == 'company' and not row['is_absent_current']:
                        require(isinstance(provenance, list) and provenance, 'Missing legal operator provenance')
                        require(all(isinstance(p, dict) and p.get('idempresa') and p.get('empresa') for p in provenance), 'Invalid legal operator provenance')
                        ids = [p['idempresa'] for p in provenance]
                        require(len(ids) == len(set(ids)), 'Duplicate legal operator provenance')
                        if row['entity_id'] == 'PLUSPETROL':
                            require(row['operator_group_rule_version'] == 'estrato-operator-groups-v1' and set(ids) <= {'PCN','PLU'} and row['periodo'] >= '2023-01-01', 'Invalid Pluspetrol grouping provenance')
                            require(row['entity_name'] == 'Pluspetrol', 'Invalid Pluspetrol display name')
                        else:
                            require(row['entity_id'] not in {'PCN', 'PLU'} or row['periodo'] < '2023-01-01', 'Ungrouped mapped legal operator')
                            require(row['operator_group_rule_version'] is None and ids == [row['entity_id']], 'Unexpected operator regrouping')
                key = (row['fluid'], row['dimension'], row['entity_id'], row['periodo'])
                require(key not in entity_keys, 'Duplicate entity grain')
                require(type(row['yoy_contribution_selected']) is bool and type(row['volume_rank']) is int and row['volume_rank'] > 0, 'Invalid prepared selection/rank')
                entity_keys.add(key)
                groups.setdefault((row['fluid'], row['dimension'], row['periodo']), []).append(row)
            else:
                key = (row['fluid'], row['periodo'])
                require(key not in total_keys, 'Duplicate total grain')
                total_keys.add(key)
    require(total_keys == {(f, p) for f in ('oil', 'gas') for p in accepted}, 'Missing accepted fluid/month')
    require(set(groups) == {(f, d, p) for f, p in total_keys for d in ('company', 'area')}, 'Missing entity dimension/month')
    for row in totals:
        for dim in ('company', 'area'):
            group = groups[(row['fluid'], dim, row['periodo'])]
            for prefix in ('', 'yoy_'):
                concentration = row[prefix+'top5_'+dim+'_share_pct']
                require(all(r[prefix+'top5_share_pct'] == concentration for r in group), 'Concentration mismatch')
            require(all(r['top5_share_yoy_pp'] == row['top5_'+dim+'_share_yoy_pp'] for r in group), 'Concentration pp mismatch')
            rest = group[0]['yoy_rest_rate_delta']
            require(all(r['yoy_rest_rate_delta'] == rest for r in group), 'Rest mismatch within dimension')
            selected = [r['yoy_rate_delta'] for r in group if r['yoy_contribution_selected']]
            if row['yoy_rate_delta'] is None:
                require(rest is None and not selected, 'Missing calendar contribution must remain null')
            else:
                require(rest is not None and all(v is not None for v in selected), 'Missing prepared rest')
                require(math.isclose(sum(selected)+rest, row['yoy_rate_delta'], rel_tol=1e-9, abs_tol=1e-6), 'Prepared contribution reconciliation failed')
            for key in MEASURES:
                expected = row[key]
                values = [r[key] for r in group]
                if expected is None:
                    require(all(v is None for v in values), 'Null comparator mismatch: ' + key)
                else:
                    require(all(v is not None for v in values), 'Missing entity comparator: ' + key)
                    require(math.isclose(sum(values), expected, rel_tol=1e-9, abs_tol=1e-6), 'Reconciliation failed: ' + key)


def validate_dbt(results, grouped=False):
    rows = results.get('results', [])
    statuses = {r['unique_id']: r['status'] for r in rows}
    for model in ('fct_production_month', 'fct_entity_growth'):
        require(any(k.endswith('.'+model) and k.startswith('model.') and v == 'success' for k,v in statuses.items()), 'Missing successful dbt publication model')
    for test in ('assert_publication_reconciliation', 'assert_publication_integrity', 'assert_publication_grain', 'assert_publication_formula'):
        require(any(k.endswith('.'+test) and k.startswith('test.') and v == 'pass' for k,v in statuses.items()), 'Missing passing dbt gate: '+test)
    if grouped:
        require(any(k.endswith('.assert_operator_groups') and k.startswith('test.') and v == 'pass' for k,v in statuses.items()), 'Missing passing dbt operator grouping gate')
        require(any(k.endswith('.operator_groups') and k.startswith('seed.') and v == 'success' for k,v in statuses.items()), 'Missing successful operator grouping seed')
    require(all(v in ('success', 'pass') for v in statuses.values()), 'dbt run contains failed/skipped/warning checks')


def export(production, entities, source_manifest, dbt_run_results, output_dir, activity=None, operator_areas=None, geo_manifest=None, areas_geometry=None, map_coverage=None):
    totals, rows, source = read_json(production), read_json(entities), read_json(source_manifest)
    validate_rows(totals, rows, source)
    validate_dbt(read_json(dbt_run_results), grouped=all('operator_group_rule_version' in row for row in rows))
    payload = {'schema_version': 1, 'status': 'candidate', 'production': sorted(totals, key=lambda r:(r['fluid'],r['periodo'])),
               'entities': sorted(rows, key=lambda r:(r['fluid'],r['dimension'],r['entity_id'],r['periodo']))}
    if rows and all('operator_group_rule_version' in row for row in rows):
        payload['operator_grouping'] = operator_group_definition()
    mapped_inputs = (activity, operator_areas, geo_manifest, areas_geometry, map_coverage)
    require(not any(mapped_inputs) or all(mapped_inputs), 'Partial mapped inputs forbidden')
    map_files = {}
    if all(mapped_inputs):
        import importlib.util
        module_spec = importlib.util.spec_from_file_location('map_export', Path(__file__).with_name('map_export.py'))
        map_export = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(map_export)
        payload['map'], map_files = map_export.prepare(read_json(activity), read_json(operator_areas), read_json(map_coverage), totals, rows, read_json(geo_manifest), areas_geometry, read_json(dbt_run_results))
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode()
    digest = hashlib.sha256(encoded).hexdigest()
    version = source['approved_period'] + '-' + digest[:12]
    manifest = {'schema_version': 1, 'version': version, 'status': 'candidate', 'data_sha256': digest,
                'generated_at': datetime.now(timezone.utc).isoformat(), 'source': source,
                'input_sha256': {name: hashlib.sha256(Path(path).read_bytes()).hexdigest() for name,path in
                                 [('production',production),('entities',entities),('dbt_run_results',dbt_run_results)]}}
    if all(mapped_inputs):
        manifest['map'] = payload['map']
        manifest['input_sha256'].update({name: hashlib.sha256(Path(path).read_bytes()).hexdigest() for name,path in zip(('activity','operator_areas','geo_manifest','areas_geometry','map_coverage'),mapped_inputs)})
    if 'operator_grouping' in payload:
        manifest['operator_grouping'] = payload['operator_grouping']
    directory = Path(output_dir)/version
    directory.mkdir(parents=True, exist_ok=False)
    try:
        for name, data in map_files.items():
            destination=directory/name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        (directory/'release.json').write_bytes(encoded)
        (directory/'manifest.json').write_text(json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False, allow_nan=False)+'\n')
    except BaseException:
        import shutil
        shutil.rmtree(directory)
        raise
    return directory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('production', 'entities', 'source-manifest', 'dbt-run-results', 'output-dir'):
        parser.add_argument('--'+name, required=True)
    for name in ('activity', 'operator-areas', 'geo-manifest', 'areas-geometry', 'map-coverage'):
        parser.add_argument('--'+name)
    args = parser.parse_args()
    print(export(args.production, args.entities, args.source_manifest, args.dbt_run_results, args.output_dir, args.activity, args.operator_areas, args.geo_manifest, args.areas_geometry, args.map_coverage))


if __name__ == '__main__':
    main()
