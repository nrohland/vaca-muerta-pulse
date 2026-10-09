import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('csv_candidate', ROOT / 'scripts/prepare_csv_candidate.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
CONTRACT = ROOT / 'contracts/production_csv.json'

class CandidateTests(unittest.TestCase):
    def candidate(self, records):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); source = root / 'source.csv'; contract = json.loads(CONTRACT.read_text())
            with source.open('w', encoding='utf-8-sig', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=list(contract)); writer.writeheader(); writer.writerows(records)
            output = root / 'candidate'
            result = module.prepare(source, CONTRACT, output, 2026, {'id': 'reviewed-official-resource'})
            return result, json.loads((output / '2026.raw.ndjson').read_text().splitlines()[0])
    def row(self):
        r = {n: '' if t == 'text' else '0' if t == 'numeric' else '2026-08-31' for n,t in json.loads(CONTRACT.read_text()).items()}
        return r | {'idpozo': '1', 'anio': '2026', 'mes': '8', 'formacion': 'vaca muerta', 'tipo_de_recurso': 'NO CONVENCIONAL'}
    def test_full_candidate_provenance_and_date_normalization(self):
        result,r=self.candidate([self.row()]);self.assertEqual(result['rows'],1);self.assertEqual(result['vm_period_rows_for_qa'],{'2026-08-01':1});self.assertFalse(result['promotion_approved']);self.assertEqual(r['fecha_data'],'2026-08-31T00:00:00');self.assertEqual(r['periodo'],'2026-08-01')
    def test_duplicate_grain_and_invalid_dates_numbers_rejected(self):
        for rows in [[self.row(),self.row()], [self.row()|{'prod_pet':'nan'}], [self.row()|{'idpozo':'1.5'}], [self.row()|{'mes':'13'}], [self.row()|{'anio':'2025'}], [self.row()|{'fecha_data':'invalid'}]]:
            with self.subTest(rows=rows),self.assertRaises((ValueError,ArithmeticError)):self.candidate(rows)
    def test_raw_scope_preserved_without_promoting_period(self):
        result,r=self.candidate([self.row()|{'formacion':'mulichinco'}]);self.assertEqual(result['rows'],1);self.assertEqual(result['vm_period_rows_for_qa'],{});self.assertEqual(r['formacion'],'mulichinco')

if __name__ == '__main__':unittest.main()
