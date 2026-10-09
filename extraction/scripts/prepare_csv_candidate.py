"""Normalize a retained official CSV against the reviewed CKAN field contract.

Fallback for CSV/DataStore lag. Never downloads, promotes, computes business metrics,
accepts periods or replaces a raw table. Feed its full annual NDJSON into the existing
isolated warehouse/dbt publication pipeline after reviewing the manifest.
"""
import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import math
from pathlib import Path
import shutil
import tempfile
from collections import Counter


def prepare(source: Path, contract_path: Path, output: Path, year: int, metadata: dict):
    if output.exists():
        raise ValueError('Candidate directory already exists')
    contract = json.loads(contract_path.read_text())
    integers = {'id', 'idpozo', 'anio', 'mes', 'idusuario'}
    periods, vm_periods = Counter(), Counter()
    seen = set()
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix='.csv-candidate-', dir=output.parent))
    checksum = hashlib.sha256()
    try:
        with source.open(encoding='utf-8-sig', newline='') as stream, (temp / f'{year}.raw.ndjson').open('wb') as target:
            reader = csv.DictReader(stream)
            if len(reader.fieldnames) != len(set(reader.fieldnames)) or set(reader.fieldnames) != set(contract):
                raise ValueError('CSV fields differ from reviewed contract')
            for row in reader:
                if None in row or None in row.values():
                    raise ValueError('Malformed CSV record')
                record = {}
                for name, kind in contract.items():
                    value = row[name]
                    if kind == 'text':
                        record[name] = value
                    elif value == '':
                        record[name] = None
                    elif kind == 'numeric':
                        decimal = Decimal(value)
                        if not decimal.is_finite() or (name in integers and decimal != decimal.to_integral_value()):
                            raise ValueError(f'Invalid numeric field: {name}')
                        record[name] = int(decimal) if name in integers else float(decimal)
                        if not math.isfinite(record[name]):
                            raise ValueError('Nonfinite value')
                    elif kind == 'timestamp':
                        # CSV fecha_data is YYYY-MM-DD; normalize to midnight, no invented timezone.
                        record[name] = datetime.fromisoformat(value).isoformat()
                    else:
                        raise ValueError(f'Unreviewed field type: {kind}')
                if record['anio'] != year or not 1 <= record['mes'] <= 12 or record['idpozo'] is None or record['idpozo'] <= 0:
                    raise ValueError('Invalid production grain')
                key = (record['idpozo'], record['anio'], record['mes'])
                if key in seen:
                    raise ValueError('Duplicate production grain')
                seen.add(key)
                period = record['periodo'] = f"{year:04d}-{record['mes']:02d}-01"
                periods[period] += 1
                if record['formacion'] == 'vaca muerta' and record['tipo_de_recurso'] == 'NO CONVENCIONAL':
                    vm_periods[period] += 1
                encoded = (json.dumps(record, ensure_ascii=False, sort_keys=True, allow_nan=False) + '\n').encode()
                target.write(encoded)
                checksum.update(encoded)
        if not seen:
            raise ValueError('Empty source')
        with source.open('rb') as source_bytes:
            csv_hash = hashlib.file_digest(source_bytes, 'sha256').hexdigest()
        manifest = {'status': 'validated-local-candidate', 'promotion_approved': False,
                    'extracted_at': datetime.now(timezone.utc).isoformat(), 'resource': metadata,
                    'transport': 'official_download_csv', 'sha256_csv': csv_hash,
                    'sha256_normalized_ndjson': checksum.hexdigest(), 'schema': contract,
                    'rows': len(seen), 'duplicate_grain': 0,
                    'period_rows': dict(sorted(periods.items())), 'vm_period_rows_for_qa': dict(sorted(vm_periods.items())),
                    'limitations': ['Source declarations are revisable; period coverage and acceptance require downstream review.',
                                    'CSV fecha_data dates become midnight timestamps without an assumed timezone.']}
        (temp / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        temp.rename(output)
        return manifest
    except BaseException:
        shutil.rmtree(temp)
        raise


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--csv', type=Path, required=True)
    p.add_argument('--contract', type=Path, required=True)
    p.add_argument('--metadata', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--year', type=int, required=True)
    a = p.parse_args()
    result = prepare(a.csv, a.contract, a.output, a.year, json.loads(a.metadata.read_text()))
    print(json.dumps({k: result[k] for k in ['status', 'rows', 'period_rows', 'sha256_csv']}))
