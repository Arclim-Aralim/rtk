"""Build the Rostov subset of the official GeoNames RU.zip dump, offline."""
import csv
import io
import json
import sys
from datetime import date
from pathlib import Path
from zipfile import ZipFile

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'services/analytics'))
from geocoding import normalize_name

source=Path(sys.argv[1])
entries=[]
with ZipFile(source) as archive:
    for row in csv.reader(io.TextIOWrapper(archive.open('RU.txt'),encoding='utf-8'),delimiter='\t'):
        if row[10]!='61':continue
        kind='district' if row[7]=='ADM2' else 'locality' if row[6]=='P' and row[7] not in ('PPLQ','PPLW','PPLH') else None
        if not kind:continue
        names=[row[1],row[2],*row[3].split(',')]
        # Keep only name keys and public geographical coordinates; never any client data.
        entries.append(dict(id=row[0],name=row[1],keys=sorted({normalize_name(n) for n in names if normalize_name(n)}),primaryKeys=sorted({normalize_name(row[1]),normalize_name(row[2])}),lat=float(row[4]),lon=float(row[5]),kind=kind,admin1=row[10],admin2=row[11]))
output=root/'services/analytics/geodata/rostov.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(dict(source='https://download.geonames.org/export/dump/RU.zip',attribution='GeoNames',license='CC BY 4.0',licenseUrl='https://creativecommons.org/licenses/by/4.0/',downloadedAt=date.today().isoformat(),regions={'Ростовская область':'61'},entries=entries),ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('GeoNames entries:',len(entries))
