"""Offline contract tests; tiny synthetic rows never stand in for source coverage."""
import copy
import importlib.util
import json
from pathlib import Path
import struct
import sys
from types import SimpleNamespace
from zipfile import ZipFile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('geo', ROOT / 'extraction/scripts/prepare_geo_candidate.py')
geo = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(geo)


def row(identifier=1):
    value = {name: None for name in geo.CONTRACT['well_fields']}
    value.update(idpozo=identifier, sigla='synthetic-mouth', formacion='vaca muerta', cuenca='NEUQUINA',
                 geojson=json.dumps({'type': 'Point', 'coordinates': [-69.1, -38.2]}),
                 geom=(b'\x01' + struct.pack('<IIdd', 0x20000001, 4326, -69.1, -38.2)).hex())
    return value


class GeometryTests(unittest.TestCase):
    def test_well_only_singer_entry_point_needs_no_production_resource(self):
        from tap_ckan_datastore.streams import CapituloIvPozosStream
        def capture(stream, context):
            self.assertIsNone(context)
            self.assertEqual(stream.resource_id, geo.CONTRACT['well_resource_id'])
            self.assertNotIn('produccion_resource_id', stream.config)
            self.assertEqual(stream.page_size, 2000)
            return iter([row()])
        with patch.object(CapituloIvPozosStream, 'get_records', capture), \
             patch.object(CapituloIvPozosStream, '_schema_from_datastore',
                          return_value={'type': 'object', 'properties': {'idpozo': {'type': 'integer'}}}), \
             patch('requests.get', side_effect=AssertionError('No network in configuration regression')):
            self.assertEqual(list(geo.source_records()), [row()])

    def test_point_order_and_source_retention(self):
        source = row()
        out = geo.normalize(source)
        self.assertEqual((out['longitude'], out['latitude']), (-69.1, -38.2))
        self.assertEqual(out['geojson'], source['geojson'])
        self.assertEqual(source, row())

    def test_missing_invalid_and_disagreement_retained(self):
        for updates, reason in [({'geojson': None, 'geom': None}, 'missing_geometry'),
                                ({'geojson': '{'}, 'invalid_geojson'),
                                ({'geojson': json.dumps({'type': 'Point', 'coordinates': [-68, -38]})}, 'geometry_disagreement'),
                                ({'geom': (b'\x01' + struct.pack('<IIdd', 0x20000001, 3857, -69.1, -38.2)).hex()}, 'invalid_geom')]:
            value = row(); value.update(updates)
            out = geo.normalize(value)
            self.assertEqual(out['geometry_status'], reason)
            self.assertIsNone(out['longitude'])

    def test_range_sentinel_bool_nan_and_swapped_no_repair(self):
        for coords in [[-200, -38], [-69, -100], [0, -38], [True, -38], [float('nan'), -38]]:
            with self.assertRaises(ValueError):
                geo.point(coords)
        # Both swapped values fit global range: no false claim of basin validation.
        self.assertEqual(geo.point([-38, -69]), (-38., -69.))

    def test_strict_fields_types_ids_and_timestamp(self):
        for identifier in [None, 0, -1, 1.5, True, 'NaN', 2**63]:
            with self.assertRaises(ValueError):
                geo.normalize(row(identifier))
        for updates in [{'extra': 1}, {'sigla': 5}, {'cota': 'Infinity'}, {'adjiv_fecha_fin_perf': 'broken'}]:
            value = row(); value.update(updates)
            with self.assertRaises(ValueError):
                geo.normalize(value)
        self.assertEqual(geo.timestamp('2026-07-08 16:48:15'), '2026-07-08T16:48:15')

    def test_mouth_many_formations_no_dedup_and_gap_counts(self):
        value = row(2); value.update(geojson=None, geom=None)
        with tempfile.TemporaryDirectory() as t:
            report = geo.write_wells(Path(t), [row(), value])
            self.assertEqual(report['rows'], 2)
            self.assertEqual(report['distinct_idpozo'], 2)
            self.assertEqual(report['distinct_sigla'], 1)
            self.assertEqual(report['geometry_status_counts'], {'valid': 1, 'missing_geometry': 1})
            self.assertEqual(len((Path(t) / 'wells.raw.ndjson').read_text().splitlines()), 2)

    def test_duplicates_fail(self):
        with tempfile.TemporaryDirectory() as t, self.assertRaises(ValueError):
            geo.write_wells(Path(t), [row(), row()])

    def test_polygon_ring_validation(self):
        good = {'type': 'Polygon', 'coordinates': [[[-69, -38], [-68, -38], [-68, -39], [-69, -38]]]}
        self.assertEqual(geo.polygon_geometry(good), good)
        bad = copy.deepcopy(good); bad['coordinates'][0][-1] = [-69, -39]
        with self.assertRaises(ValueError):
            geo.polygon_geometry(bad)


class AreaTests(unittest.TestCase):
    def test_duplicate_requires_exact_quarantine_and_preserves_both(self):
        prj = 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]'
        shapes = []
        for code in ['AVI', 'AVI', 'BAS']:
            attributes = {f[0]: '' for f in geo.CONTRACT['area_dbf_fields']}
            attributes.update(CODIGO_DE_=code, GEOJSON='deliberately truncated {')
            shape = SimpleNamespace(__geo_interface__={'type': 'Polygon', 'coordinates': [[[-69, -38], [-68, -38], [-68, -39], [-69, -38]]]})
            shapes.append(SimpleNamespace(record=SimpleNamespace(as_dict=lambda a=attributes: a), shape=shape))
        reader = SimpleNamespace(fields=[['DeletionFlag']] + geo.CONTRACT['area_dbf_fields'], iterShapeRecords=lambda: iter(shapes))
        with tempfile.TemporaryDirectory() as t:
            path = Path(t)
            archive = path / 'source.zip'
            with ZipFile(archive, 'w') as z:
                for ext in ['.shp', '.shx', '.dbf']: z.writestr('test' + ext, '')
                z.writestr('test.prj', prj)
            metadata = path / 'metadata.json'
            metadata.write_text(json.dumps({'success': True, 'result': {'id': geo.CONTRACT['area_package_id'], 'resources': [{'id': geo.CONTRACT['area_resource_id'], 'package_id': geo.CONTRACT['area_package_id'], 'format': 'SHP', 'last_modified': '2026-09-22T07:04:36'}]}}))
            with patch.dict(sys.modules, {'shapefile': SimpleNamespace(Reader=lambda **kwargs: reader)}):
                for exclusions in [[], ['BAS'], ['AVI', 'BAS']]:
                    with self.assertRaises(ValueError):
                        geo.write_areas(path, archive, metadata, exclusions)
                result = geo.write_areas(path, archive, metadata, ['AVI'])
            self.assertEqual(result['rows'], 1)
            self.assertEqual(result['quarantined_features'], {'AVI': 2})
            self.assertEqual(len((path / 'areas.quarantined.ndjson').read_text().splitlines()), 2)
            output = json.loads((path / 'areas.normalized.ndjson').read_text())
            self.assertEqual(output['area_id'], 'BAS')
            self.assertNotIn('GEOJSON', output['attributes'])


class CandidateTests(unittest.TestCase):
    def test_two_pass_drift_atomic_cleanup(self):
        with tempfile.TemporaryDirectory() as t:
            output = Path(t) / 'candidate'
            with patch.object(geo, 'metadata', return_value={'id': 'synthetic', 'last_modified': '2026-07-08T16:48:15'}), \
                 patch.object(geo, 'source_records', side_effect=[iter([row()]), iter([row(2)])]), \
                 self.assertRaises(ValueError):
                geo.prepare(output)
            self.assertFalse(output.exists())
            self.assertEqual(list(Path(t).iterdir()), [])

    def test_metadata_drift_and_empty_snapshot_fail_closed(self):
        for source, snapshots in [([row()], [{'last_modified': '2026-01-01'}, {'last_modified': '2026-01-02'}]),
                                  ([], [{'last_modified': '2026-01-01'}])]:
            with tempfile.TemporaryDirectory() as t:
                output = Path(t) / 'candidate'
                with patch.object(geo, 'metadata', side_effect=snapshots), \
                     patch.object(geo, 'source_records', return_value=iter(source)), \
                     self.assertRaises(ValueError):
                    geo.prepare(output)
                self.assertFalse(output.exists())

    def test_repeat_same_data_hash_accepted_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as t:
            output = Path(t) / 'candidate'
            with patch.object(geo, 'metadata', return_value={'id': 'synthetic', 'last_modified': '2026-07-08T16:48:15'}), \
                 patch.object(geo, 'source_records', side_effect=[iter([row()]), iter([row()])]):
                manifest = geo.prepare(output)
            self.assertTrue(manifest['wells']['stable_two_passes'])
            self.assertFalse(manifest['promotion_approved'])
            with self.assertRaises(ValueError):
                geo.prepare(output)


if __name__ == '__main__':
    unittest.main()
