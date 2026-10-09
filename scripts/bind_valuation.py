"""Bind the monthly price artifact to exact reviewed production release bytes."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from datetime import datetime, timezone
p=argparse.ArgumentParser();p.add_argument('--data-dir',type=Path,required=True);a=p.parse_args();d=a.data_dir
manifest=json.loads((d/'manifest.json').read_text());r=(d/'release.json').read_bytes();prices=(d/'prices.json').read_bytes();price=json.loads(prices)
assert hashlib.sha256(r).hexdigest()==manifest['data_sha256']
assert price['schema_version']==1 and price['source']['unit']=='USD/bbl' and price['source']['provider']=='EIA'
seen=set()
for row in price['prices']:
 assert re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])-01', row['periodo']) and row['periodo'] not in seen and type(row['usd_per_bbl']) in (int,float) and math.isfinite(row['usd_per_bbl']) and row['usd_per_bbl']>0;seen.add(row['periodo'])
missing=[p for p in manifest['source']['accepted_periods'] if p not in seen]
(d/'valuation-manifest.json').write_text(json.dumps({'schema_version':1,'status':'candidate','release_sha256':manifest['data_sha256'],'prices_sha256':hashlib.sha256(prices).hexdigest(),'generated_at':datetime.now(timezone.utc).isoformat(),'missing_oil_price_periods':missing,'method':'monthly bbl × monthly EIA Brent USD/bbl; daily = monthly value / calendar days. No realized revenues.','gas_status':'unavailable'},ensure_ascii=False,indent=2)+'\n')
print('Bound price history; missing accepted periods:',missing)
