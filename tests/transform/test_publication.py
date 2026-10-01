"""Synthetic test-only inputs. These are never official releases."""
import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('export_release', ROOT/'transform/publication/export_release.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import duckdb
        connection = duckdb.connect(str(ROOT/'transform/offline/target/synthetic_tests.duckdb'), read_only=True)
        def rows(table):
            cur = connection.execute('select * from '+table)
            names = [d[0] for d in cur.description]
            return json.loads(json.dumps([dict(zip(names,r)) for r in cur.fetchall()], default=str))
        cls.totals = rows('fct_production_month')
        cls.entities = rows('fct_entity_growth')
        connection.close()
        cls.source = {'data_kind': 'official', 'approved_period': '2024-05-01',
                      'accepted_periods': ['2023-02-01','2023-03-01','2023-05-01','2024-01-01','2024-02-01','2024-03-01','2024-05-01'],
                      'accepted_at': '2024-04-01T00:00:00Z', 'commit': 'synthetic-unittest-only',
                      'resources': [{'id': 'synthetic-test-only', 'url': 'https://example.invalid/synthetic-test-only', 'hash_unavailable_reason': 'test only'}]}

    def test_reconciles_both_fluids_and_dimensions(self):
        exporter.validate_rows(self.totals, self.entities, self.source)

    def test_synthetic_cannot_export(self):
        source = dict(self.source, data_kind='synthetic_test')
        with self.assertRaisesRegex(ValueError, 'Synthetic'):
            exporter.validate_rows(self.totals, self.entities, source)

    def test_duplicate_entity_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            exporter.validate_rows(self.totals, self.entities+[self.entities[0]], self.source)

    def test_incorrect_signed_delta_rejected(self):
        rows = copy.deepcopy(self.entities)
        row = next(r for r in rows if r['yoy_rate_delta'] is not None)
        row['yoy_rate_delta'] += 1
        with self.assertRaisesRegex(ValueError, '[Rr]econciliation'):
            exporter.validate_rows(self.totals, rows, self.source)

    def test_missing_calendar_null_rejected(self):
        rows = copy.deepcopy(self.entities)
        row = next(r for r in rows if r['yoy_volume'] is None)
        row['yoy_volume'] = 0
        with self.assertRaisesRegex(ValueError, 'Null comparator'):
            exporter.validate_rows(self.totals, rows, self.source)

    def test_missing_fluid_month_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Missing accepted'):
            exporter.validate_rows(self.totals[:-1], self.entities, self.source)

    def test_nonfinite_rejected(self):
        rows = copy.deepcopy(self.totals)
        rows[0]['rate'] = float('inf')
        with self.assertRaisesRegex(ValueError, 'Invalid measure'):
            exporter.validate_rows(rows, self.entities, self.source)

    def test_prepared_rest_tampering_rejected(self):
        rows = copy.deepcopy(self.entities)
        row = next(r for r in rows if r['yoy_rest_rate_delta'] is not None)
        row['yoy_rest_rate_delta'] += 1
        with self.assertRaises(ValueError):
            exporter.validate_rows(self.totals, rows, self.source)

    def test_unapproved_source_cutoff_rejected(self):
        source = dict(self.source, approved_period='2024-06-01')
        with self.assertRaisesRegex(ValueError, 'Approved period'):
            exporter.validate_rows(self.totals, self.entities, source)

    def test_failed_dbt_rejected(self):
        results = json.loads((ROOT/'transform/offline/target/run_results.json').read_text())
        exporter.validate_dbt(results)
        results['results'][0]['status'] = 'fail'
        with self.assertRaises(ValueError):
            exporter.validate_dbt(results)

    def test_export_is_candidate_immutable_and_hashed(self):
        # The synthetic fixture is confined to a temporary unittest directory.
        # A production caller must supply actual official dbt rows/provenance.
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            for name, rows in [('production',self.totals),('entities',self.entities),('source',self.source)]:
                (tmp/(name+'.json')).write_text(json.dumps(rows))
            args = [tmp/'production.json',tmp/'entities.json',tmp/'source.json',ROOT/'transform/offline/target/run_results.json',tmp/'candidates']
            result = exporter.export(*args)
            manifest = json.loads((result/'manifest.json').read_text())
            data = (result/'release.json').read_bytes()
            self.assertEqual(manifest['status'], 'candidate')
            self.assertEqual(exporter.hashlib.sha256(data).hexdigest(), manifest['data_sha256'])
            with self.assertRaises(FileExistsError):
                exporter.export(*args)


if __name__ == '__main__':
    unittest.main()
