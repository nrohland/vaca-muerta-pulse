#!/usr/bin/env python3
"""Prepare an isolated annual raw candidate from reviewed official CKAN resources."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile

import requests
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'plugins/tap-ckan-datastore'))
from tap_ckan_datastore.tap import TapCkanDatastore
from tap_ckan_datastore.streams import ProduccionPozoMesStream

API = 'https://datos.energia.gob.ar/api/3/action/'


def chosen_resources(years: list[int]) -> dict[int, str]:
    catalog = yaml.safe_load((Path(__file__).resolve().parents[1] / 'resources/cap4.yml').read_text())
    chosen = {}
    for entry in catalog['produccion_anual']:
        # First listing is the reviewed annual resource, never an identifier clone.
        chosen.setdefault(entry['year'], entry['resource_id'])
    if len(years) != len(set(years)) or any(year not in chosen for year in years):
        raise ValueError('Choose distinct years from the reviewed annual catalog')
    return {year: chosen[year] for year in years}


def official_metadata(resource_id: str) -> dict:
    response = requests.get(API + 'resource_show', params={'id': resource_id}, timeout=120)
    response.raise_for_status()
    payload = response.json()
    if not payload.get('success') or payload['result'].get('id') != resource_id:
        raise ValueError('Official resource metadata mismatch')
    resource = payload['result']
    return {key: resource.get(key) for key in
            ('id', 'name', 'url', 'format', 'last_modified', 'created', 'hash', 'datastore_active')}


def write_year(directory: Path, year: int, resource_id: str, qa_vm: bool) -> dict:
    metadata = official_metadata(resource_id)
    tap = TapCkanDatastore(config={'produccion_resource_id': resource_id})
    stream = ProduccionPozoMesStream(tap)
    schema = stream.schema
    periods = Counter()
    count = 0
    digest = hashlib.sha256()
    qa_count = 0
    qa_file = (directory / f'{year}.qa-vm.ndjson').open('x') if qa_vm else None
    try:
        with (directory / f'{year}.raw.ndjson').open('xb') as output:
            for row in stream.get_records(None):
                if row['anio'] != year:
                    raise ValueError('Annual resource contains an unexpected year')
                line = (json.dumps(row, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + '\n').encode()
                output.write(line)
                digest.update(line)
                count += 1
                periods[row['periodo']] += 1
                if qa_file and str(row.get('formacion', '')).strip().lower() == 'vaca muerta' and row.get('tipo_de_recurso') == 'NO CONVENCIONAL':
                    qa_file.write(line.decode())
                    qa_count += 1
    finally:
        if qa_file:
            qa_file.close()
    after = official_metadata(resource_id)
    if after != metadata:
        raise ValueError('Resource metadata changed during extraction')
    return {'year': year, 'resource': metadata, 'rows': count,
            'period_rows': dict(sorted(periods.items())), 'duplicate_grain': 0,
            'schema': schema, 'sha256_normalized_ndjson': digest.hexdigest(),
            'qa_vm_rows': qa_count if qa_vm else None,
            'missing_calendar_months': [month for month in range(1, 13) if f'{year}-{month:02d}-01' not in periods]}


def prepare(output: Path, years: list[int], qa_vm: bool = False) -> dict:
    resources = chosen_resources(years)
    if output.exists():
        raise ValueError('Candidate output must be a new directory')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.candidate-', dir=output.parent))
    try:
        manifest = {'status': 'validated-local-candidate', 'promotion_approved': False,
                    'extracted_at': datetime.now(timezone.utc).isoformat(),
                    'scope': 'full annual production; QA filter never changes raw',
                    'resources': [write_year(temporary, year, rid, qa_vm) for year, rid in resources.items()],
                    'limitations': ['CKAN is mutable: same-count edits during paging cannot be excluded.',
                                    'Checksum covers normalized downloaded rows, not original CSV bytes.',
                                    'Calendar coverage and warehouse reconciliation need manual review.']}
        (temporary / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        temporary.rename(output)
        return manifest
    except BaseException:
        shutil.rmtree(temporary)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--years', type=int, nargs='+', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--qa-vm', action='store_true', help='Write a separate local QA sample alongside full raw')
    args = parser.parse_args()
    prepare(args.output, args.years, args.qa_vm)
    print('Local annual candidate prepared; warehouse load and promotion remain pending.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
