"""Fill existing imported entities from the local gazetteer. No external API requests."""
import collections
import os
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'services/analytics'))
os.environ.setdefault('DATA_DIR',str(root/'data/analytics'))
import main
from geocoding import geocode_record

for kind in ['companies','projects']:
    counts=collections.Counter()
    with main.connect() as con:
        rows=con.execute('SELECT body FROM records WHERE kind=?',(kind,)).fetchall()
        for record in rows:
            row=main.json.loads(record['body'])
            if row.get('demo'):continue
            updated=geocode_record(row,kind)
            counts[updated.get('geoMatchStatus','provided')]+=1
            main.put(con,kind,updated)
    print(kind,dict(counts))
