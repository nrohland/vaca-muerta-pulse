"""Import EIA's official monthly Brent history from a retained HTML response.

Usage: python scripts/import_brent.py --source response.html --output prices.json
No guessed prices, interpolation or daily-to-monthly aggregation.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re

URL = 'https://www.eia.gov/dnav/pet/hist/leafhandler.ashx?f=m&n=pet&s=rbrte'

class Table(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows = []; self.row = []; self.cell = None
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row = []
        if tag == 'td': self.cell = ''
    def handle_data(self, data):
        if self.cell is not None: self.cell += data
    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None: self.row.append(self.cell.strip()); self.cell = None
        if tag == 'tr': self.rows.append(self.row)

def parse(raw):
    text = raw.decode('utf-8'); table = Table(); table.feed(text)
    prices = []
    for row in table.rows:
        if len(row) != 13 or not re.fullmatch(r'\d{4}', row[0]): continue
        for m, cell in enumerate(row[1:], 1):
            if cell in ['', '-', '--', 'NA', 'W']: continue
            if not re.fullmatch(r'\d+\.\d{2}', cell) or float(cell) <= 0:
                raise ValueError('Unrecognized EIA price')
            prices.append({'periodo': f'{int(row[0]):04d}-{m:02d}-01', 'usd_per_bbl': float(cell)})
    release = re.search(r'Release Date:\s*(\d{1,2}/\d{1,2}/\d{4})', text)
    if not prices or not release: raise ValueError('Missing EIA history or release date')
    if len({p['periodo'] for p in prices}) != len(prices): raise ValueError('Duplicate EIA month')
    return {'schema_version': 1, 'source': {'provider': 'EIA', 'series': 'Europe Brent Spot Price FOB', 'url': URL,
            'unit': 'USD/bbl', 'frequency': 'monthly', 'source_updated_at': datetime.strptime(release[1], '%m/%d/%Y').date().isoformat(),
            'retrieved_at': datetime.now(timezone.utc).isoformat(), 'response_sha256': hashlib.sha256(raw).hexdigest()},
            'prices': prices,
            'gas': {'status': 'unavailable', 'reason': 'No se validó una serie mensual comparable para Vaca Muerta ni el poder calorífico para convertir m³ a MMBtu.',
                    'reviewed_sources': ['https://datos.energia.gob.ar/dataset/precios-de-gas-natural', 'https://www.argentina.gob.ar/economia/energia/hidrocarburos/plan-gasar']}}

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--source', required=True, type=Path); p.add_argument('--output', required=True, type=Path); a=p.parse_args()
    result=parse(a.source.read_bytes()); a.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print('Imported',len(result['prices']),'months; latest',result['prices'][-1]['periodo'])
