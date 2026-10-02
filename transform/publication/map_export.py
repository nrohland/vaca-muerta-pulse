"""Serialization and reconciliation of dbt map marts; no business metrics."""
import gzip
import hashlib
import json
import math
from pathlib import Path
from datetime import datetime
import calendar


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def close(actual, expected, label):
    require((actual is None) == (expected is None), 'Map null mismatch: '+label)
    if expected is not None:
        require(type(actual) in (int,float) and math.isfinite(actual) and type(expected) in (int,float) and math.isfinite(expected),'Invalid validation measure: '+label)
        require(math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-6), 'Map reconciliation: '+label)


def total(values):
    return sum(values) if values and all(x is not None for x in values) else None


COUNTS=('reported_well_rows','valid_volume_rows','positive_producing_wells','located_well_rows','missing_catalog_well_rows','invalid_coordinate_well_rows','located_positive_wells','unlocated_positive_wells','missing_area_well_rows','missing_area_ids')

def validate_coverage(row, members):
    expected={'reported_well_rows':len(members),'valid_volume_rows':sum(r['volume'] is not None for r in members),'positive_producing_wells':sum(r['positive_production'] for r in members),'located_well_rows':sum(r['coordinate_valid'] for r in members),'missing_catalog_well_rows':sum(not r['catalog_present'] for r in members),'invalid_coordinate_well_rows':sum(r['catalog_present'] and not r['coordinate_valid'] for r in members),'located_positive_wells':sum(r['positive_production'] and r['coordinate_valid'] for r in members),'unlocated_positive_wells':sum(r['positive_production'] and not r['coordinate_valid'] for r in members),'missing_area_well_rows':sum(not r['area_geometry_available'] for r in members),'missing_area_ids':len({r['area_id'] for r in members if not r['area_geometry_available']})}
    require(all(type(row[k]) is int and row[k]>=0 and row[k]==v for k,v in expected.items()),'Coverage counts disagree with activity')
    for field,numerator,denominator in [('coordinate_coverage','located_well_rows','reported_well_rows'),('positive_coordinate_coverage','located_positive_wells','positive_producing_wells')]:
        expected_value=expected[numerator]/expected[denominator] if expected[denominator] else None
        value=row[field]
        require(value is None or (type(value) in (int,float) and math.isfinite(value) and 0<=value<=1),'Invalid coverage ratio')
        close(value,expected_value,field)


def shift_month(period, months):
    date=datetime.fromisoformat(period)
    absolute=date.year*12+date.month-1+months
    return f'{absolute//12:04d}-{absolute%12+1:02d}-01'


def prepare(activity, details, coverage, totals, entities, geo_manifest, area_path, results):
    statuses={r['unique_id']:r['status'] for r in results.get('results',[])}
    for model in ('fct_well_activity_month','fct_operator_area_month','fct_map_coverage_month'):
        require(any(k.startswith('model.') and k.endswith('.'+model) and v=='success' for k,v in statuses.items()), 'Missing map model: '+model)
    for gate in ('assert_map_grain','assert_map_integrity','assert_map_reconciliation','assert_map_metrics'):
        require(any(k.startswith('test.') and k.endswith('.'+gate) and v=='pass' for k,v in statuses.items()), 'Missing map gate: '+gate)
    require(geo_manifest.get('wells',{}).get('stable_two_passes') is True, 'Unstable geo source')
    for section in ('wells','areas'):
        require(len(geo_manifest.get(section,{}).get('sha256_normalized_ndjson',''))==64, 'Missing geo source hash')
    well_resource=geo_manifest['wells'].get('resource',{})
    for section in ('wells','areas'):
        resource=geo_manifest[section].get('resource',{})
        require(all(resource.get(k) for k in ('id','url','last_modified')),'Missing geo source metadata')
    catalog_date=datetime.fromisoformat(well_resource['last_modified'].replace('Z','+00:00'))
    data=Path(area_path).read_bytes()
    require(sha(data)==geo_manifest['areas']['sha256_normalized_ndjson'], 'Area source hash mismatch')
    areas=[json.loads(line) for line in data.decode().splitlines() if line.strip()]
    area_ids=[r['area_id'] for r in areas]
    require(len(area_ids)==len(set(area_ids)), 'Area geometry fanout')
    require(len(areas)==geo_manifest['areas']['rows'], 'Area source count mismatch')
    keys=set(); by_month={}; detail_keys=set(); detail_month={}; cover_keys=set()
    available_area_ids={r['area_id'] for r in areas if r['geometry_status']=='valid'}
    for r in activity:
        key=(r['fluid'],r['periodo'],r['idpozo'])
        require(key not in keys,'Duplicate activity grain'); keys.add(key)
        require(type(r['idpozo']) is int and r['idpozo']>0,'Invalid activity ID')
        require(r['fluid'] in ('oil','gas'),'Invalid map fluid')
        require(r['volume_unit']==('bbl' if r['fluid']=='oil' else 'million_m3'),'Invalid map unit')
        require(r['cuenca'].lower()=='neuquina','Map basin classification outside scope')
        for field in ('legal_operator_id','legal_operator_name','operator_group_id','operator_group_name','area_id','area_name'):
            require(bool(r.get(field)), 'Missing map identity '+field)
        for field in ('volume','rate'):
            require(type(r[field]) in (int,float) and math.isfinite(r[field]) and r[field]>=0,'Invalid map measure')
        date=datetime.fromisoformat(r['periodo'])
        close(r['rate'],r['volume']/calendar.monthrange(date.year,date.month)[1],'activity rate')
        require(type(r['positive_production']) is bool and r['positive_production']==(r['volume']>0),'Invalid positive production')
        require(type(r['coordinate_valid']) is bool and type(r['catalog_present']) is bool,'Invalid coordinate flags')
        if r['catalog_present']:
            require(r['geo_source_resource_id']==well_resource['id'],'Geo resource identity mismatch')
            require(r['catalog_at'] is not None and datetime.fromisoformat(r['catalog_at'].replace('Z','+00:00'))==catalog_date,'Geo catalog date mismatch')
        if r['coordinate_valid']:
            x,y=r['longitude'],r['latitude']
            require(type(x) in (int,float) and type(y) in (int,float) and math.isfinite(x) and math.isfinite(y) and -180<=x<=180 and -90<=y<=90 and x!=0 and y!=0 and r['catalog_at'] and r['geo_source_resource_id'],'Invalid map coordinates')
        else:
            require(r['longitude'] is None and r['latitude'] is None and r['coordinate_issue'],'Missing coordinate must remain null')
        if r['legal_operator_id'] in ('PCN','PLU') and r['periodo']>='2023-01-01':
            require(r['operator_group_id']=='PLUSPETROL' and r['operator_group_rule_version']=='estrato-operator-groups-v1','Map operator grouping bypass')
        require(type(r['area_geometry_available']) is bool and r['area_geometry_available']==(r['area_id'] in available_area_ids),'Area availability differs from dbt input')
        by_month.setdefault(key[:2],[]).append(r)
    measures=('volume','rate','yoy_volume','yoy_rate','mom_volume','mom_rate','yoy_volume_delta','yoy_rate_delta','mom_volume_delta','mom_rate_delta')
    for r in details:
        key=(r['fluid'],r['periodo'],r['operator_group_id'],r['area_id'])
        require(key not in detail_keys,'Duplicate operator-area grain');detail_keys.add(key)
        detail_month.setdefault(key[:2],[]).append(r)
        for field in measures+('yoy_volume_pct','yoy_rate_pct','mom_volume_pct','mom_rate_pct','operator_volume_share_pct'):
            require(r[field] is None or (type(r[field]) in (int,float) and math.isfinite(r[field])),'Invalid detail measure')
    for r in coverage:
        key=(r['fluid'],r['periodo']);require(key not in cover_keys,'Duplicate coverage grain');cover_keys.add(key)
    expected={(r['fluid'],r['periodo']) for r in totals}
    require(set(by_month)==set(detail_month)==cover_keys==expected,'Map missing/extra fluid month')
    for t in totals:
        key=(t['fluid'],t['periodo']);a=by_month[key];d=detail_month[key]
        c=next(r for r in coverage if (r['fluid'],r['periodo'])==key)
        for field in ('volume','rate'):
            close(total([r[field] for r in a]),t[field],field);close(c[field],t[field],'coverage '+field)
        for field in measures:
            close(total([r[field] for r in d]),t[field],field)
        require(len(a)==t['reported_well_rows']==c['reported_well_rows'],'Activity source coverage count')
        require(sum(r['positive_production'] for r in a)==t['positive_producing_wells']==c['positive_producing_wells'],'Positive well reconciliation')
        checks={'located_well_rows':sum(r['coordinate_valid'] for r in a),'missing_catalog_well_rows':sum(not r['catalog_present'] for r in a),'invalid_coordinate_well_rows':sum(r['catalog_present'] and not r['coordinate_valid'] for r in a),'located_positive_wells':sum(r['positive_production'] and r['coordinate_valid'] for r in a),'unlocated_positive_wells':sum(r['positive_production'] and not r['coordinate_valid'] for r in a),'missing_area_well_rows':sum(not r['area_geometry_available'] for r in a)}
        require(all(c[f]==v for f,v in checks.items()),'Coverage counts disagree with activity')
        validate_coverage(c,a)
        for row in d:
            member=[r for r in a if r['operator_group_id']==row['operator_group_id'] and r['area_id']==row['area_id']]
            validate_coverage(row,member)
            require(type(row['is_absent_current']) is bool and row['is_absent_current']==(not member),'Detail absent flag mismatch')
            for field in ('volume','rate'):
                close(row[field],sum(r[field] for r in member),'detail '+field)
            for comparator,shift in (('yoy',-12),('mom',-1)):
                prior_key=(key[0],shift_month(key[1],shift))
                prior=[r for r in by_month.get(prior_key,[]) if r['operator_group_id']==row['operator_group_id'] and r['area_id']==row['area_id']]
                for field in ('volume','rate'):
                    expected_prior=sum(r[field] for r in prior) if prior_key in by_month else None
                    close(row[comparator+'_'+field],expected_prior,'detail comparator')
                    expected_delta=row[field]-expected_prior if expected_prior is not None else None
                    close(row[comparator+'_'+field+'_delta'],expected_delta,'detail delta')
                    expected_pct=100*expected_delta/expected_prior if expected_prior else None
                    close(row[comparator+'_'+field+'_pct'],expected_pct,'detail growth percentage')
            operator_volume=sum(r['volume'] for r in a if r['operator_group_id']==row['operator_group_id'])
            close(row['operator_volume_share_pct'],100*row['volume']/operator_volume if operator_volume else None,'operator area share')
        for e in (e for e in entities if (e['fluid'],e['periodo'])==key):
            member=[r for r in d if r['operator_group_id' if e['dimension']=='company' else 'area_id']==e['entity_id']]
            for field in measures:
                close(total([r[field] for r in member]) if member else (None if e[field] is None else 0),e[field],'entity '+field)
    files={}
    def add(path,value,compress=False):
        encoded=canonical(value)
        if compress:
            encoded=gzip.compress(encoded,mtime=0)
        files[path]=encoded
        reference={'path':path,'sha256':sha(encoded),'bytes':len(encoded)}
        if compress:
            reference['compression']='gzip'
        return reference
    months=[]
    for key,rows in sorted(by_month.items()):
        fluid,period=key
        features=[{'type':'Feature','id':r['idpozo'],'geometry':{'type':'Point','coordinates':[r['longitude'],r['latitude']]} if r['coordinate_valid'] else None,'properties':r} for r in sorted(rows,key=lambda r:r['idpozo'])]
        entry={'fluid':fluid,'periodo':period,'activity':add('map/'+fluid+'/'+period+'.geojson.gz',{'type':'FeatureCollection','features':features},compress=True), 'operator_areas':add('map/'+fluid+'/'+period+'-operator-areas.json',sorted(detail_month[key],key=lambda r:(r['operator_group_id'],r['area_id']))),'coverage':next(r for r in coverage if (r['fluid'],r['periodo'])==key)}
        months.append(entry)
    used={r['area_id'] for r in activity}
    outlines=[]
    for r in areas:
        if r['area_id'] in used:
            require(r['geometry_status']=='valid' and r['coordinate_crs']=='EPSG:4326','Invalid used area geometry')
            geometry=r['geometry'];require(geometry['type'] in ('Polygon','MultiPolygon'),'Invalid area type')
            outlines.append({'type':'Feature','id':r['area_id'],'geometry':geometry,'properties':{'area_id':r['area_id'],'attributes':r['attributes']}})
    index={'schema_version':1,'scope':'production-classified VM / Neuquina; no spatial basin validation','catalog_semantics':'current positions; production attributes and period are historical declarations','source_manifest_sha256':sha(canonical(geo_manifest)),'source_metadata':{section:{'resource':{k:geo_manifest[section]['resource'][k] for k in ('id','url','last_modified')},'license':geo_manifest[section].get('license'),'quarantined_features':geo_manifest[section].get('quarantined_features',{})} for section in ('wells','areas')},'date_semantics':{'catalog_at':'resource last_modified; preserve naive timestamp without asserted timezone','periodo':'historical production month; source attributes declared in this month'},'months':months,'areas':add('map/areas.geojson',{'type':'FeatureCollection','features':outlines})}
    index_ref=add('map/index.json',index)
    return {'schema_version':1,'index':index_ref},files
