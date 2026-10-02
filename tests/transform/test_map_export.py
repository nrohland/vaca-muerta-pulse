"""Synthetic contracts and tamper tests against the shared dbt SQL output."""
import copy
import gzip
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
import test_publication as publication
ROOT, exporter = publication.ROOT, publication.exporter


class MapExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        publication.ExportGateTests.setUpClass()
        import duckdb
        connection=duckdb.connect(str(ROOT/'transform/offline/target/synthetic_tests.duckdb'),read_only=True)
        def rows(table):
            cursor=connection.execute('select * from '+table)
            return json.loads(json.dumps([dict(zip([d[0] for d in cursor.description],r)) for r in cursor.fetchall()],default=str))
        cls.activity=rows('fct_well_activity_month')
        cls.details=rows('fct_operator_area_month')
        cls.coverage=rows('fct_map_coverage_month')
        connection.close()

    def inputs(self,tmp):
        tmp=Path(tmp)
        outline={'area_id':'X','geometry_status':'valid','coordinate_crs':'EPSG:4326','attributes':{},'geometry':{'type':'Polygon','coordinates':[[[-69,-40],[-68,-40],[-68,-39],[-69,-40]]]}}
        other=dict(outline,area_id='GROUPAREA')
        area=(json.dumps(outline)+'\n'+json.dumps(other)+'\n').encode();(tmp/'areas.ndjson').write_bytes(area)
        resource={'id':'fixture','url':'https://example.invalid/fixture','last_modified':'2026-07-08T16:48:15'}
        geo={'wells':{'resource':resource,'stable_two_passes':True,'sha256_normalized_ndjson':'a'*64},'areas':{'resource':resource,'license':'synthetic-test-only','quarantined_features':{'AVI':2},'rows':2,'sha256_normalized_ndjson':hashlib.sha256(area).hexdigest()}}
        for name,value in [('production',publication.ExportGateTests.totals),('entities',publication.ExportGateTests.entities),('source',publication.ExportGateTests.source),('activity',self.activity),('details',self.details),('coverage',self.coverage),('geo',geo)]:
            (tmp/(name+'.json')).write_text(json.dumps(value))
        return [tmp/'production.json',tmp/'entities.json',tmp/'source.json',ROOT/'transform/offline/target/run_results.json',tmp/'candidate'],dict(activity=tmp/'activity.json',operator_areas=tmp/'details.json',geo_manifest=tmp/'geo.json',areas_geometry=tmp/'areas.ndjson',map_coverage=tmp/'coverage.json')

    def test_release_hash_anchors_index_and_all_lazy_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            args,kwargs=self.inputs(tmp);directory=exporter.export(*args,**kwargs)
            release=json.loads((directory/'release.json').read_text())
            anchor=release['map']['index'];raw=(directory/anchor['path']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(),anchor['sha256'])
            index=json.loads(raw)
            missing_found=False
            for entry in index['months']:
                for field in ('activity','operator_areas'):
                    reference=entry[field];raw=(directory/reference['path']).read_bytes()
                    self.assertEqual(hashlib.sha256(raw).hexdigest(),reference['sha256'])
                features=json.loads(gzip.decompress((directory/entry['activity']['path']).read_bytes()))['features']
                self.assertEqual(entry['activity']['compression'],'gzip')
                self.assertEqual(len(features),entry['coverage']['reported_well_rows'])
                missing_found |= any(f['geometry'] is None for f in features)
            self.assertTrue(missing_found)
            self.assertEqual(len(index['months']),18)
            self.assertEqual(index['source_metadata']['wells']['resource']['id'],'fixture')
            self.assertEqual(index['source_metadata']['areas']['quarantined_features'],{'AVI':2})
            self.assertIn('periodo',index['date_semantics'])

    def test_partial_mapped_input_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            args,kwargs=self.inputs(tmp);kwargs.pop('map_coverage')
            with self.assertRaisesRegex(ValueError,'Partial mapped'):
                exporter.export(*args,**kwargs)

    def test_activity_duplicate_and_volume_tamper_rejected(self):
        for mode in ('duplicate','volume'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as tmp:
                args,kwargs=self.inputs(tmp);rows=copy.deepcopy(self.activity)
                if mode=='duplicate': rows.append(rows[0])
                else: rows[0]['volume']+=1
                kwargs['activity'].write_text(json.dumps(rows))
                with self.assertRaises(ValueError):exporter.export(*args,**kwargs)

    def test_geo_source_hash_tamper_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            args,kwargs=self.inputs(tmp);kwargs['areas_geometry'].write_text('{}\n')
            with self.assertRaisesRegex(ValueError,'Area source hash'):exporter.export(*args,**kwargs)

    def test_missing_map_gate_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            args,kwargs=self.inputs(tmp)
            results=json.loads(args[3].read_text());results['results']=[r for r in results['results'] if not r['unique_id'].endswith('.assert_map_grain')]
            path=Path(tmp)/'results.json';path.write_text(json.dumps(results));args[3]=path
            with self.assertRaisesRegex(ValueError,'Missing map gate'):exporter.export(*args,**kwargs)

    def test_prepared_coverage_tamper_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            args,kwargs=self.inputs(tmp);rows=copy.deepcopy(self.coverage);rows[0]['located_well_rows']+=1
            kwargs['map_coverage'].write_text(json.dumps(rows))
            with self.assertRaisesRegex(ValueError,'Coverage counts'):exporter.export(*args,**kwargs)

    def test_shared_sql_fanout_gate_detects_duplicate_catalog(self):
        import duckdb
        import shutil
        query=(ROOT/'transform/offline/target/compiled/vaca_muerta_pulse/../tests/publication/assert_map_grain.sql')
        matches=list((ROOT/'transform/offline/target/compiled').rglob('assert_map_grain.sql'))
        self.assertEqual(len(matches),1)
        sql=matches[0].read_text()
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'synthetic_tests.duckdb'
            shutil.copyfile(ROOT/'transform/offline/target/synthetic_tests.duckdb',target)
            connection=duckdb.connect(str(target))
            self.assertEqual(connection.execute(sql).fetchall(),[])
            connection.execute('insert into synthetic_well_geo select * from synthetic_well_geo where idpozo=1')
            self.assertIn(('catalog_fanout',),connection.execute(sql).fetchall())
            connection.close()

    def test_monthly_gzip_deterministic(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            args,kwargs=self.inputs(first);a=exporter.export(*args,**kwargs)
            args,kwargs=self.inputs(second);b=exporter.export(*args,**kwargs)
            self.assertEqual((a/'release.json').read_bytes(),(b/'release.json').read_bytes())
            for path in a.rglob('*.geojson.gz'):
                self.assertEqual(path.read_bytes(),(b/path.relative_to(a)).read_bytes())

    def test_all_prepared_metrics_tamper_rejected(self):
        cases=[('details','located_well_rows',999),('details','coordinate_coverage',42),('details','yoy_volume_pct',999),('details','operator_volume_share_pct',999),('coverage','coordinate_coverage',42),('coverage','missing_area_ids',999),('details','positive_coordinate_coverage',float('nan'))]
        count_fields=('reported_well_rows','valid_volume_rows','positive_producing_wells','located_well_rows','missing_catalog_well_rows','invalid_coordinate_well_rows','located_positive_wells','unlocated_positive_wells','missing_area_well_rows','missing_area_ids')
        cases += [(table,field,999) for table in ('details','coverage') for field in count_fields]
        for table,field,value in cases:
            with self.subTest(table=table,field=field),tempfile.TemporaryDirectory() as tmp:
                args,kwargs=self.inputs(tmp)
                path=Path(tmp)/(table+'.json');rows=json.loads(path.read_text());rows[0][field]=value;path.write_text(json.dumps(rows))
                with self.assertRaises(ValueError):exporter.export(*args,**kwargs)

    def test_geo_identity_and_catalog_date_tamper_rejected(self):
        for field,value in [('geo_source_resource_id','wrong'),('catalog_at','2026-07-09 16:48:15')]:
            with self.subTest(field=field),tempfile.TemporaryDirectory() as tmp:
                args,kwargs=self.inputs(tmp);rows=copy.deepcopy(self.activity)
                next(r for r in rows if r['catalog_present'])[field]=value
                kwargs['activity'].write_text(json.dumps(rows))
                with self.assertRaises(ValueError):exporter.export(*args,**kwargs)

    def test_shared_sql_metrics_gate_rejects_actual_mutations(self):
        import duckdb
        import shutil
        sql=next((ROOT/'transform/offline/target/compiled').rglob('assert_map_metrics.sql')).read_text()
        cases=[('fct_operator_area_month','located_well_rows',999),('fct_operator_area_month','coordinate_coverage',42),('fct_operator_area_month','yoy_volume_pct',999),('fct_operator_area_month','operator_volume_share_pct',999),('fct_map_coverage_month','coordinate_coverage',42),('fct_map_coverage_month','missing_area_ids',999)]
        count_fields=('reported_well_rows','valid_volume_rows','positive_producing_wells','located_well_rows','missing_catalog_well_rows','invalid_coordinate_well_rows','located_positive_wells','unlocated_positive_wells','missing_area_well_rows','missing_area_ids')
        cases += [(table,field,999) for table in ('fct_operator_area_month','fct_map_coverage_month') for field in count_fields]
        cases += [('fct_operator_area_month','positive_coordinate_coverage',42),('fct_map_coverage_month','positive_coordinate_coverage',42)]
        for table,field,value in cases:
            with self.subTest(table=table,field=field),tempfile.TemporaryDirectory() as tmp:
                target=Path(tmp)/'synthetic_tests.duckdb';shutil.copyfile(ROOT/'transform/offline/target/synthetic_tests.duckdb',target)
                connection=duckdb.connect(str(target));self.assertEqual(connection.execute(sql).fetchall(),[])
                connection.execute(f'update {table} set {field}={value}')
                self.assertTrue(connection.execute(sql).fetchall());connection.close()
