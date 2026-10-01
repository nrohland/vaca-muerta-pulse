"""Exercise the actual schema macro locally without warehouse access."""
from pathlib import Path
from types import SimpleNamespace
import unittest

from jinja2 import Environment

ROOT = Path(__file__).resolve().parents[2]
MACRO = (ROOT/'transform/macros/generate_schema_name.sql').read_text()


class CandidateSchemaTests(unittest.TestCase):
    def schema(self, custom, target='dev', suffix=''):
        def reject(message):
            raise ValueError(message)
        import re
        template = Environment().from_string(MACRO)
        module = template.make_module({
            'target': SimpleNamespace(name=target, schema='profile_fallback'),
            'env_var': lambda name, default: suffix if name == 'DBT_CANDIDATE_SUFFIX' else default,
            'modules': SimpleNamespace(re=re),
            'exceptions': SimpleNamespace(raise_compiler_error=reject),
        })
        return module.generate_schema_name(custom, None).strip()

    def test_default_dataset_names_unchanged(self):
        for target in ('dev', 'dev_oauth', 'prod'):
            for layer in ('stg', 'int', 'marts'):
                expected = layer+'_cap4'+('' if target=='prod' else '_dev')
                self.assertEqual(self.schema(layer, target), expected)

    def test_suffix_isolates_each_candidate_layer(self):
        for target in ('dev', 'dev_oauth', 'prod'):
            for layer in ('stg', 'int', 'marts'):
                expected = layer+'_cap4'+('' if target=='prod' else '_dev')+'_candidate_20261001_A'
                self.assertEqual(self.schema(layer, target, 'candidate_20261001_A'), expected)

    def test_custom_and_profile_fallback_preserved(self):
        self.assertEqual(self.schema(None, suffix='candidate'), 'profile_fallback')
        self.assertEqual(self.schema(' custom_schema ', suffix='candidate'), 'custom_schema')

    def test_unsafe_suffix_rejected(self):
        for suffix in ('bad-name', 'bad.name', 'bad name', 'bad/name', 'name\n', 'ñ', "x';drop"):
            with self.subTest(suffix=suffix), self.assertRaisesRegex(ValueError, 'DBT_CANDIDATE_SUFFIX'):
                self.schema('marts', suffix=suffix)


if __name__ == '__main__':
    unittest.main()
