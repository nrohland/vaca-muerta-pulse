"""Offline contract and failure-path tests; fixtures are not official source evidence."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'plugins/tap-ckan-datastore'))
from tap_ckan_datastore.streams import ProduccionPozoMesStream, _as_int, _periodo_from_anio_mes
from tap_ckan_datastore.tap import TapCkanDatastore


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


FIELDS = json.loads((ROOT / 'catalogs/produccion_pozo_mes.fields.json').read_text())['fields']


def result(rows=(), total=3, fields=None):
    return {'records': list(rows), 'total': total, 'fields': FIELDS if fields is None else fields}


def row(i, well=None):
    return {f['id']: None for f in FIELDS} | {'_id': i, 'idpozo': i if well is None else well, 'anio': '2025.0', 'mes': '1'}


def stream():
    with patch.object(ProduccionPozoMesStream, '_datastore_search', return_value=result()):
        instance = ProduccionPozoMesStream(TapCkanDatastore(config={'produccion_resource_id': 'fixture', 'page_size': 2}))
        instance.schema
        return instance


class ContractTests(unittest.TestCase):
    def test_integrals_preserve_precision(self):
        self.assertEqual(_as_int('9007199254740993'), 9007199254740993)
        self.assertEqual(_as_int('3.0'), 3)
        for value in ('1.9', 'NaN', 'Infinity', True, 'garbage'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                _as_int(value)

    def test_dates_fail_closed(self):
        self.assertEqual(_periodo_from_anio_mes({'anio': 2024, 'mes': 2}), '2024-02-01')
        for year, month in ((0, 1), (10000, 1), (2025, 0), (2025, 13), (2025, 1.2), (None, 1)):
            with self.subTest(year=year, month=month), self.assertRaises(ValueError):
                _periodo_from_anio_mes({'anio': year, 'mes': month})

    def run_pages(self, pages, config=None):
        s = stream()
        if config:
            s._config.update(config)
        with patch.object(s, '_datastore_search', side_effect=pages):
            return list(s.get_records(None))

    def test_stable_pages_and_no_business_filter(self):
        output = self.run_pages([result(), result([row(1), row(2)]), result([row(3)]), result()])
        self.assertEqual(len(output), 3)
        self.assertEqual(output[0]['periodo'], '2025-01-01')
        self.assertNotIn('_id', output[0])

    def test_short_server_page_continues(self):
        self.assertEqual(len(self.run_pages([result(), result([row(1)]), result([row(2), row(3)]), result()])), 3)

    def test_paging_failures(self):
        for page in (result([]), result([row(2), row(1)]), result([row(1), row(2, 1)]),
                     result([row(1)], total=4), result([row(1)], fields=FIELDS[:-1]),
                     result([row(1), row(2), row(3)])):
            with self.subTest(page=page), self.assertRaises(ValueError):
                self.run_pages([result(), page])

    def test_end_verification_rejects_change(self):
        with self.assertRaises(ValueError):
            self.run_pages([result(total=1), result([row(1)], total=1), result(total=2)])

    def test_estimated_total_and_unknown_schema(self):
        for initial in (result() | {'total_was_estimated': True}, result(fields=FIELDS[:-1])):
            with self.assertRaises(ValueError):
                self.run_pages([initial])

    def test_capped_smoke_and_reemit_guard(self):
        self.assertEqual(len(self.run_pages([result(), result([row(1)]), result()], {'max_records': 1})), 1)
        with self.assertRaises(ValueError):
            self.run_pages([], {'max_records': 1, 'reemit': True})
        with patch.dict('os.environ', {'REEMIT': 'true'}), self.assertRaises(ValueError):
            self.run_pages([], {'max_records': 1})

    def test_request_has_deterministic_sort_and_exact_total(self):
        s = stream()
        with patch('tap_ckan_datastore.streams.requests.get') as get:
            get.return_value.json.return_value = {'success': True, 'result': result()}
            s._datastore_search(limit=2, offset=2)
            params = get.call_args.kwargs['params']
            self.assertEqual(params['sort'], 'idpozo asc,anio asc,mes asc')
            self.assertEqual(params['offset'], 2)
            self.assertTrue(params['include_total'])
            self.assertNotIn('total_estimation_threshold', params)

    def test_official_shape_without_internal_id(self):
        first, second = row(1), row(2)
        del first['_id']
        del second['_id']
        self.assertEqual(len(self.run_pages([result(total=2), result([first], total=2), result([second], total=2), result(total=2)])), 2)
        with self.assertRaises(ValueError):
            self.run_pages([result(total=2), result([second], total=2), result([first], total=2)])

    def test_count_uses_supported_exact_total_request(self):
        compare = load_script('compare_source_count')
        with patch.object(compare.requests, 'get') as get:
            get.return_value.json.return_value = {'success': True, 'result': result()}
            self.assertEqual(compare.datastore_total('fixture'), 3)
            self.assertEqual(get.call_args.kwargs['params'], {'resource_id': 'fixture', 'limit': 0, 'include_total': True})
            get.return_value.json.return_value = {'success': True, 'result': result() | {'total_was_estimated': True}}
            with self.assertRaises(ValueError):
                compare.datastore_total('fixture')

    def test_candidate_cleanup_and_no_overwrite(self):
        candidate = load_script('prepare_history_candidate')
        self.assertEqual(candidate.chosen_resources([2025])[2025], 'd774b5d7-0756-48fe-88f2-8729b57b22da')
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'candidate'
            with patch.object(candidate, 'write_year', side_effect=ValueError('partial')), self.assertRaises(ValueError):
                candidate.prepare(output, [2025])
            self.assertEqual(list(Path(tmp).iterdir()), [])
            output.mkdir()
            with self.assertRaises(ValueError):
                candidate.prepare(output, [2025])

    def test_candidate_year_qa_and_checksum(self):
        candidate = load_script('prepare_history_candidate')
        records = [dict(row(1), periodo='2025-01-01', anio=2025, formacion='vaca muerta', tipo_de_recurso='NO CONVENCIONAL'),
                   dict(row(2), periodo='2025-01-01', anio=2025, formacion='otra')]
        with tempfile.TemporaryDirectory() as tmp, patch.object(candidate, 'official_metadata', return_value={'id': 'fixture'}), patch.object(candidate.ProduccionPozoMesStream, 'schema', {'type': 'object'}), patch.object(candidate.ProduccionPozoMesStream, 'get_records', return_value=iter(records)):
            profile = candidate.write_year(Path(tmp), 2025, 'fixture', True)
            self.assertEqual(profile['rows'], 2)
            self.assertEqual(profile['qa_vm_rows'], 1)
            import hashlib
            self.assertEqual(profile['sha256_normalized_ndjson'], hashlib.sha256((Path(tmp) / '2025.raw.ndjson').read_bytes()).hexdigest())

    def test_complete_record_types_and_nullable_source_fields(self):
        valid = row(1) | {'prod_pet': '12.5', 'fechaingreso': '2025-01-01T03:04:05'}
        output = self.run_pages([result(total=1), result([valid], total=1), result(total=1)])
        self.assertEqual(output[0]['prod_pet'], 12.5)
        self.assertIsNone(output[0]['prod_gas'])
        for field, value in (('prod_pet', 'not-a-number'), ('prod_gas', float('nan')),
                             ('prod_agua', float('inf')), ('prod_pet', True),
                             ('empresa', 123), ('fechaingreso', 'not-a-date'),
                             ('fecha_data', '2025-02-30T00:00:00'), ('idpozo', None)):
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                self.run_pages([result(total=1), result([row(1) | {field: value}], total=1)])
        missing = row(1)
        del missing['prod_pet']
        with self.assertRaises(ValueError):
            self.run_pages([result(total=1), result([missing], total=1)])

    def test_candidate_invalid_volume_cleans_partial_output(self):
        candidate = load_script('prepare_history_candidate')
        invalid = row(1) | {'prod_pet': 'not-a-number'}
        # Exercise the real iterator and writer together, mocking only network.
        pages = [result(total=1), result(total=1), result(total=1), result([invalid], total=1)]
        with tempfile.TemporaryDirectory() as tmp, patch.object(candidate, 'official_metadata', return_value={'id': 'fixture'}), patch.object(ProduccionPozoMesStream, '_datastore_search', side_effect=pages):
            output = Path(tmp) / 'candidate'
            with self.assertRaises(ValueError):
                candidate.prepare(output, [2025])
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_compare_year_predicate_and_mismatch_exit(self):
        from types import SimpleNamespace
        from unittest.mock import MagicMock
        compare = load_script('compare_source_count')
        for count, partition, expected in ((3, 'MONTH', 0), (2, 'MONTH', 1), (3, 'DAY', 1)):
            client = MagicMock()
            client.query.return_value.result.side_effect = [
                [SimpleNamespace(row_count=count)], [], [], []]
            client.get_table.return_value = SimpleNamespace(
                time_partitioning=SimpleNamespace(type_=partition, field='_sdc_batched_at'),
                clustering_fields=['empresa', 'idpozo', 'cuenca'], num_rows=count,
                num_bytes=1, streaming_buffer=None)
            with patch.object(compare.bigquery, 'Client', return_value=client), patch.object(compare, 'datastore_total', return_value=3), patch.object(sys, 'argv', ['compare', '--year', '2025', '--project', 'fixture']), patch('builtins.print'):
                self.assertEqual(compare.main(), expected)
            call = client.query.call_args_list[0]
            self.assertIn('WHERE anio = @year', call.args[0])
            self.assertEqual(call.kwargs['job_config'].query_parameters[0].value, 2025)
            self.assertEqual(call.kwargs['job_config'].maximum_bytes_billed, 1024**3)


if __name__ == '__main__':
    unittest.main()
