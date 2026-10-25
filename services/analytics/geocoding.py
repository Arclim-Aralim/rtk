"""Offline locality/district geocoding. Never resolves or claims a business premises."""
import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

TRANSLIT = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя', ['a','b','v','g','d','e','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','kh','ts','ch','sh','shch','','y','','e','yu','ya']))


def normalize_name(value):
    value = unicodedata.normalize('NFC', ''.join(c for c in unicodedata.normalize('NFKD', str(value or '').casefold()) if c not in ('\u0301','\u0300'))).replace('ё','е')
    value = re.sub(r'^(?:г\.|город\s|х\.|хутор\s|п\.|пос[.]|поселок\s|с\.|село\s|ст-ца\s|станица\s|сл[.]|слобода\s|рп\s|рабочий поселок\s)\s*', '', value)
    value = re.sub(r'\s*(?:район|р-н|district|rayon|rajon)\s*$', '', value)
    value = ''.join(TRANSLIT.get(c,c) for c in value)
    value = re.sub(r'[^a-z0-9]','',value)
    # GeoNames alternate transliterations: -skiy/-skij/-sky denote the same suffix.
    return re.sub(r'ski(?:y|j)$','sky',value)


@lru_cache(maxsize=1)
def load_gazetteer():
    file = Path(__file__).parent/'geodata'/'rostov.json'
    return json.loads(file.read_text(encoding='utf-8')) if file.exists() else {'regions':{},'entries':[]}


def locate(region, locality, district='', gazetteer=None, district_only=False):
    data = gazetteer if gazetteer is not None else load_gazetteer()
    region_code = data['regions'].get(region)
    if not region_code or not locality: return {'status':'missing_locality_or_region'}
    key = normalize_name(locality)
    matches = [p for p in data['entries'] if p['admin1']==region_code and p['kind']==('district' if district_only else 'locality') and key in p['keys']]
    primary = [p for p in matches if key in p.get('primaryKeys',[])]
    if primary: matches=primary
    if len(matches)>1 and district:
        district_key=normalize_name(district)
        districts={p['admin2'] for p in data['entries'] if p['admin1']==region_code and p['kind']=='district' and district_key in p['keys']}
        narrower=[p for p in matches if p['admin2'] and p['admin2'] in districts]
        if narrower: matches=narrower
    if not matches:return {'status':'not_found','query':locality}
    if len(matches)>1:return {'status':'ambiguous','query':locality,'candidates':len(matches)}
    p=matches[0]
    return dict(status='matched',lat=p['lat'],lon=p['lon'],geoAccuracy='district' if district_only else 'locality',geoSource='GeoNames · CC BY 4.0',geoSourceUrl=f'https://www.geonames.org/{p["id"]}/',geoMatchedName=p['name'],geoDatasetDate=data.get('downloadedAt'),geoQuery=locality)


def geocode_record(record, kind, gazetteer=None):
    row=record.copy()
    # User-supplied point coordinates and confirmed operating sites remain authoritative.
    if row.get('lat') is not None and row.get('lon') is not None and row.get('geoAccuracy') not in ('locality','district'):
        return row
    if kind=='companies':
        locality=row.get('registrationLocality')
        district=row.get('registrationDistrict','')
        result=locate(row.get('registrationRegion') or row.get('region'),locality or district,district,gazetteer,district_only=not bool(locality))
    elif kind=='projects':
        municipality=row.get('municipality','')
        district_only=bool(re.search(r'район|р-н',municipality,re.I))
        result=locate(row.get('region'),municipality,gazetteer=gazetteer,district_only=district_only)
    else:return row
    row['geoMatchStatus']=result.pop('status')
    if row['geoMatchStatus']=='matched':row.update(result)
    else:
        row.update(lat=None,lon=None,geoAccuracy='unknown')
    return row
