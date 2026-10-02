#!/usr/bin/env python3
"""Retain a complete, stable official geography candidate; never publish it."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
import math
from pathlib import Path
import shutil
import struct
import sys
import tempfile
from zipfile import ZipFile


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'plugins/tap-ckan-datastore'))

API = 'https://datos.energia.gob.ar/api/3/action/'
CONTRACT = json.loads((Path(__file__).resolve().parents[1] / 'resources/geo-contract.json').read_text())


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False,
                       separators=(',', ':')) + '\n').encode()


def timestamp(value):
    """Normalize ISO spelling; source naive timestamps remain timezone-unspecified."""
    if value is None or value == '':
        return None
    if not isinstance(value, str):
        raise ValueError('Invalid timestamp type')
    return datetime.fromisoformat(value.replace('Z', '+00:00')).isoformat()


def point(value):
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError('Point must contain two coordinates')
    if any(isinstance(n, bool) or not isinstance(n, (float, int)) for n in value):
        raise ValueError('Invalid coordinate type')
    lon, lat = value
    if not all(math.isfinite(n) for n in value) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
        raise ValueError('Coordinates outside WGS84')
    if lon == 0 or lat == 0:
        raise ValueError('Zero coordinate sentinel')
    return float(lon), float(lat)


def ewkb_point(value):
    data = bytes.fromhex(value)
    if len(data) != 25 or data[0] not in (0, 1):
        raise ValueError('Expected EWKB Point with SRID')
    order = '<' if data[0] else '>'
    kind, srid, lon, lat = struct.unpack(order + 'IIdd', data[1:])
    if kind != 0x20000001 or srid != 4326:
        raise ValueError('Expected 2D Point EPSG4326')
    return point([lon, lat])


def coordinates(row):
    """No swapping, geocoding or substitution when variants conflict or fail."""
    variants = []
    errors = []
    for name in ('geojson', 'geom'):
        if row[name] in (None, ''):
            continue
        try:
            if name == 'geojson':
                geo = json.loads(row[name])
                if geo.get('type') != 'Point' or 'crs' in geo:
                    raise ValueError('Unsupported GeoJSON Point/CRS')
                variants.append(point(geo.get('coordinates')))
            else:
                variants.append(ewkb_point(row[name]))
        except (ValueError, TypeError, AttributeError, struct.error):
            errors.append('invalid_' + name)
    if errors:
        return None, None, '+'.join(errors)
    if not variants:
        return None, None, 'missing_geometry'
    if len(variants) == 2 and any(abs(a - b) > 1e-8 for a, b in zip(*variants)):
        return None, None, 'geometry_disagreement'
    return *variants[0], 'valid'


def normalize(row):
    if set(row) != set(CONTRACT['well_fields']):
        raise ValueError('Well record differs from reviewed fields')
    out = dict(row)
    for name, kind in CONTRACT['well_fields'].items():
        value = out[name]
        if kind == 'text' and value is not None and not isinstance(value, str):
            raise ValueError('Invalid text field: ' + name)
        if kind == 'timestamp':
            out[name] = timestamp(value)
        if kind == 'numeric' and value is not None:
            if isinstance(value, bool):
                raise ValueError('Invalid numeric field: ' + name)
            try:
                number = Decimal(str(value))
            except InvalidOperation as exc:
                raise ValueError('Invalid numeric field: ' + name) from exc
            if not number.is_finite():
                raise ValueError('Nonfinite numeric field: ' + name)
            out[name] = float(number)
    out['idpozo'] = _as_int(row['idpozo'])
    if out['idpozo'] is None or not 0 < out['idpozo'] <= 2**63 - 1:
        raise ValueError('Positive integral idpozo required')
    out['longitude'], out['latitude'], out['geometry_status'] = coordinates(row)
    out['coordinate_crs'] = 'EPSG:4326'
    out['coordinate_valid'] = out['geometry_status'] == 'valid'
    out['coordinate_issue'] = None if out['coordinate_valid'] else out['geometry_status']
    return out


def _as_int(value):
    # Same integral identifier contract as the Singer tap; no rounding/coercion.
    if value is None or value == '':
        return None
    if isinstance(value, bool):
        raise ValueError('Boolean identifier')
    try:
        number = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError('Invalid identifier') from exc
    if not number.is_finite() or number != number.to_integral_value():
        raise ValueError('Expected finite integral identifier')
    return int(number)


def source_records():
    # Defer the substantial Singer import tree until a live extraction is requested.
    from tap_ckan_datastore.tap import TapCkanDatastore
    from tap_ckan_datastore.streams import CapituloIvPozosStream, field_contract
    class GeographyTap(TapCkanDatastore):
        # This entry point selects only the well stream. Production's mandatory
        # resource is intentionally not required; never supply a dummy resource.
        config_jsonschema = {**TapCkanDatastore.config_jsonschema,
                             'required': ['pozos_resource_id']}
    class GeographyStream(CapituloIvPozosStream):
        """Singer source/pagination retained, with the reviewed well contract."""
        def _datastore_search(self, *, limit, offset=0):
            result = super()._datastore_search(limit=limit, offset=offset)
            if field_contract(result.get('fields', [])) != CONTRACT['well_fields']:
                raise ValueError('Well schema differs from reviewed contract')
            return result

        def _schema_from_datastore(self):
            result = self._datastore_search(limit=0)
            if field_contract(result.get('fields', [])) != CONTRACT['well_fields']:
                raise ValueError('Well schema differs from reviewed contract')
            return super()._schema_from_datastore()
    
        def _normalize(self, row):
            source = {k: v for k, v in row.items() if k not in ('_id', '_full_text')}
            normalize(source)  # Strict source type/identifier checks before Singer emission.
            out = dict(source)
            out['idpozo'] = _as_int(source['idpozo'])
            return out
    tap = GeographyTap(config={'pozos_resource_id': CONTRACT['well_resource_id'],
                               'page_size': 2000})
    return GeographyStream(tap).get_records(None)


def metadata(resource_id):
    import requests
    response = requests.get(API + 'resource_show', params={'id': resource_id}, timeout=120)
    response.raise_for_status()
    payload = response.json()
    if not payload.get('success') or payload['result'].get('id') != resource_id:
        raise ValueError('Official metadata identity mismatch')
    result = payload['result']
    if result.get('package_id') != CONTRACT['well_package_id'] or not result.get('datastore_active'):
        raise ValueError('Unexpected well package or inactive DataStore')
    timestamp(result.get('last_modified'))
    return {k: result.get(k) for k in ('id', 'package_id', 'url', 'format', 'last_modified',
                                      'created', 'hash', 'datastore_active')}


def write_wells(directory, records, catalog_at=None):
    raw_hash, normalized_hash = hashlib.sha256(), hashlib.sha256()
    gaps, vm_gaps = Counter(), Counter()
    ids, mouths = set(), set()
    previous = None
    count = vm_count = 0
    with (directory / 'wells.raw.ndjson').open('xb') as raw, (directory / 'wells.normalized.ndjson').open('xb') as normalized:
        for row in records:
            out = normalize(row)
            out['catalog_at'] = timestamp(catalog_at)
            out['source_resource_id'] = CONTRACT['well_resource_id']
            key = out['idpozo']
            if key in ids or (previous is not None and key <= previous):
                raise ValueError('Duplicate or non-increasing idpozo')
            previous = key
            ids.add(key)
            if out['sigla']:
                mouths.add(out['sigla'])
            gaps[out['geometry_status']] += 1
            if str(out['formacion'] or '').strip().lower() == 'vaca muerta' and str(out['cuenca'] or '').strip().upper() == 'NEUQUINA':
                vm_count += 1
                vm_gaps[out['geometry_status']] += 1
            for value, output, digest in ((row, raw, raw_hash), (out, normalized, normalized_hash)):
                line = encoded(value)
                output.write(line)
                digest.update(line)
            count += 1
    if count == 0:
        raise ValueError('Empty full well snapshot')
    return {'rows': count, 'distinct_idpozo': len(ids), 'distinct_sigla': len(mouths),
            'duplicate_idpozo': 0, 'geometry_status_counts': dict(gaps),
            'vm_neuquina_current_catalog_rows': vm_count, 'vm_neuquina_geometry_status_counts': dict(vm_gaps),
            'sha256_raw_ndjson': raw_hash.hexdigest(), 'sha256_normalized_ndjson': normalized_hash.hexdigest()}


def polygon_geometry(geo):
    if geo['type'] not in ('Polygon', 'MultiPolygon'):
        raise ValueError('Expected Polygon or MultiPolygon')
    polygons = [geo['coordinates']] if geo['type'] == 'Polygon' else geo['coordinates']
    if not polygons:
        raise ValueError('Empty polygon')
    for polygon in polygons:
        if not polygon:
            raise ValueError('Empty polygon rings')
        for ring in polygon:
            if len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError('Unclosed or incomplete polygon ring')
            for pair in ring:
                point(pair)
    return geo


def write_areas(directory, archive, package_path, exclude_codes=()):
    import shapefile
    package = json.loads(package_path.read_text())
    if not package.get('success') or package['result'].get('id') != CONTRACT['area_package_id']:
        raise ValueError('Area package identity mismatch')
    resource = next(r for r in package['result']['resources'] if r['id'] == CONTRACT['area_resource_id'])
    if resource.get('format') != 'SHP' or resource.get('package_id') != CONTRACT['area_package_id']:
        raise ValueError('Area resource identity/format mismatch')
    timestamp(resource['last_modified'])
    data = archive.read_bytes()
    codes, gaps = set(), Counter()
    exclude_codes = set(exclude_codes)
    excluded_counts = Counter()
    digest = hashlib.sha256()
    with ZipFile(io.BytesIO(data)) as z:
        def member(ext):
            names = [n for n in z.namelist() if n.lower().endswith(ext)]
            if len(names) != 1:
                raise ValueError('Expected one shapefile member: ' + ext)
            return z.read(names[0])
        prj = member('.prj').decode()
        # Require the exact reviewed WGS84 definition, rather than substring inference.
        expected_prj = 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]'
        if prj.strip() != expected_prj:
            raise ValueError('Unreviewed shapefile CRS')
        reader = shapefile.Reader(shp=io.BytesIO(member('.shp')), shx=io.BytesIO(member('.shx')),
                                  dbf=io.BytesIO(member('.dbf')), encoding='utf-8')
        if [list(f) for f in reader.fields[1:]] != CONTRACT['area_dbf_fields']:
            raise ValueError('Unreviewed DBF schema')
        shapes = list(reader.iterShapeRecords())
        source_codes = Counter(sr.record.as_dict()['CODIGO_DE_'].strip() for sr in shapes)
        duplicated = {code for code, n in source_codes.items() if n > 1}
        if '' in source_codes or duplicated != exclude_codes:
            raise ValueError('Duplicate area codes require explicit exact quarantine; unexpected exclusion')
        quarantine = (directory / 'areas.quarantined.ndjson').open('xb')
        with quarantine, (directory / 'areas.normalized.ndjson').open('xb') as output:
            for sr in shapes:
                record = sr.record.as_dict()
                code = record['CODIGO_DE_'].strip()
                if not code or (code in codes and code not in exclude_codes):
                    raise ValueError('Missing or duplicate SESCO area code')
                codes.add(code)
                try:
                    geo = polygon_geometry(sr.shape.__geo_interface__)
                    status = 'valid'
                except (ValueError, AttributeError, IndexError, TypeError):
                    geo, status = None, 'invalid_geometry'
                gaps[status] += 1
                # Never parse truncated DBF GEOJSON; preserve only other attributes.
                attributes = {k: v for k, v in record.items() if k != 'GEOJSON'}
                for name in ('ALTA_PLANO', 'MODIFICACI'):
                    attributes[name] = timestamp(attributes[name])
                line = encoded({'area_id': code, 'codigo_de_sesco': code, 'geometry': geo, 'geometry_status': status,
                                'attributes': attributes, 'coordinate_crs': 'EPSG:4326'})
                if code in exclude_codes:
                    quarantine.write(line)
                    excluded_counts[code] += 1
                else:
                    output.write(line)
                    digest.update(line)
    (directory / 'areas.source.zip').write_bytes(data)
    return {'resource': resource, 'license': package['result'].get('license_title'),
            'rows': len(codes - exclude_codes), 'source_features': len(shapes),
            'source_distinct_codes': len(codes), 'quarantined_features': dict(excluded_counts),
            'sha256_quarantined_ndjson': hashlib.sha256((directory / 'areas.quarantined.ndjson').read_bytes()).hexdigest(),
            'geometry_status_counts': dict(gaps), 'crs_wkt': prj,
            'sha256_source_zip': hashlib.sha256(data).hexdigest(),
            'sha256_normalized_ndjson': digest.hexdigest(),
            'limitations': ['Local SHP supplied by operator; download freshness was not rechecked.',
                            'CSV/SHP versions differ; production code domain/join coverage pending.',
                            'Ring validation checks structure and ranges, not topological validity.']}


def prepare(output, areas_zip=None, areas_metadata=None, exclude_codes=()):
    if output.exists():
        raise ValueError('Candidate must use a new output directory')
    if bool(areas_zip) != bool(areas_metadata):
        raise ValueError('Area ZIP and metadata must be supplied together')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.geo-', dir=output.parent))
    try:
        before = metadata(CONTRACT['well_resource_id'])
        wells = write_wells(temporary, source_records(), before['last_modified'])
        after = metadata(CONTRACT['well_resource_id'])
        if after != before:
            raise ValueError('Metadata changed during snapshot')
        verify = temporary / 'verification'
        verify.mkdir()
        repeated = write_wells(verify, source_records(), before['last_modified'])
        final = metadata(CONTRACT['well_resource_id'])
        if repeated != wells or final != before:
            raise ValueError('Full repeated snapshot hash/count/metadata differs')
        shutil.rmtree(verify)
        wells['resource'] = before
        wells['stable_two_passes'] = True
        manifest = {'status': 'validated-local-candidate', 'promotion_approved': False,
                    'extracted_at_utc': datetime.now(timezone.utc).isoformat(),
                    'scope': 'Complete national catalog; no production or geographic filter applied to raw',
                    'contract': CONTRACT, 'wells': wells,
                    'areas': write_areas(temporary, areas_zip, areas_metadata, exclude_codes) if areas_zip else None,
                    'limitations': ['Current catalog does not reconstruct historical well locations/attributes.',
                                    'idpozo identifies formation record; sigla identifies physical mouth.',
                                    'No production join performed; never expand production by mouth/coordinates.',
                                    'No basin polygon provided: points outside Neuquina not spatially checked.',
                                    'Missing/invalid coordinates retained with nulls; no guessed positions.',
                                    'Source naive timestamps have no asserted timezone.',
                                    'Two complete identical passes reduce mutable-source risk but are not a server transaction.',
                                    'SHA256 raw covers canonical DataStore rows, not source CSV bytes.',
                                    'License for well package requires package metadata review before promotion.']}
        (temporary / 'manifest.json').write_bytes(encoded(manifest))
        temporary.rename(output)
        return manifest
    except BaseException:
        shutil.rmtree(temporary)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--areas-zip', type=Path)
    parser.add_argument('--areas-metadata', type=Path)
    parser.add_argument('--exclude-area-code', action='append', default=[], help='Explicitly quarantine every feature of an observed duplicate code')
    args = parser.parse_args()
    result = prepare(args.output, args.areas_zip, args.areas_metadata, args.exclude_area_code)
    print(json.dumps({'status': result['status'], 'rows': result['wells']['rows']}))


if __name__ == '__main__':
    main()
