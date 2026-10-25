import csv
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
import main
import registry


def encode(rows):
    stream=io.StringIO()
    columns=list(dict.fromkeys(key for row in rows for key in row))
    writer=csv.DictWriter(stream,columns,delimiter=';');writer.writeheader();writer.writerows(rows)
    return stream.getvalue().encode('utf-8')


def company(inn='0265052371', **values):
    return dict(inn=inn,name='Тестовая организация',region='Ростовская область',registrationLocality='г. Сальск',**values)


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.override=patch.object(main,'DB',Path(self.temp.name)/'test.sqlite3');self.override.start()
        main.initialize();self.client=TestClient(main.app)

    def tearDown(self):
        self.client.close();self.override.stop();self.temp.cleanup()

    def upload(self,kind,rows,as_of='2026-10-10'):
        return self.client.post(f'/source-import/{kind}?asOf={as_of}',content=encode(rows))

    def test_exact_inn_matching_preserves_leading_zero_and_customer_flag(self):
        self.assertEqual(self.upload('fns',[company(),company('7701234567')]).status_code,200)
        before=self.client.get('/registry-status').json();self.assertEqual(before['unknownClients'],2)
        self.assertEqual(self.upload('clients',[company()]).status_code,200)
        rows=self.client.get('/companies?demo=false&registryStatus=all').json()
        mapping={r['inn']:r for r in rows}
        self.assertTrue(mapping['0265052371']['client']);self.assertFalse(mapping['7701234567']['client'])
        self.assertEqual(mapping['7701234567']['clientMatch'],'not_in_uploaded_base')
        self.upload('fns',[company()]);self.assertTrue(self.client.get('/companies?demo=false&q=0265052371').json()[0]['client'])

    def test_msp_exclusion_is_not_company_closure(self):
        self.upload('fns',[company(mspExcludedAt='10.07.2026',mspIncludedAt='10.07.2022')])
        self.assertEqual(self.client.get('/companies?demo=false').json(),[])
        rows=self.client.get('/companies?demo=false&registryStatus=excluded').json()
        self.assertEqual(rows[0]['activityStatus'],'unknown');self.assertIsNone(rows[0]['terminationDate'])
        self.assertEqual(self.client.get('/registry-status').json()['terminated'],0)

    def test_unknown_financials_and_coordinates_stay_unknown(self):
        unknown = company(); unknown['registrationLocality']='Неизвестный тестовый населённый пункт'
        self.upload('clients',[unknown])
        insight=self.client.get('/insights?demo=false').json()
        self.assertIsNone(insight['revenue']);self.assertIsNone(insight['growth']);self.assertEqual(insight['locatedCompanies'],0)
        self.assertEqual(self.client.get('/companies?demo=false&minRevenue=1').json(),[])
        row=self.client.get('/companies?demo=false').json()[0]
        self.assertIsNone(row['lat']);self.assertEqual(row['mapLocations'],[])

    def test_operating_sites_and_cross_locality_do_not_rewrite_registration(self):
        self.upload('clients',[company()])
        site=dict(inn='0265052371',region='Ростовская область',locality='г. Азов',address='Тестовый офис, Азов',source='Тестовый официальный сайт',sourceUrl='https://example.org/contacts',observedAt='2026-10-20',status='candidate',lat=47.1,lon=39.4)
        self.assertEqual(self.upload('sites',[site]).status_code,200)
        self.assertEqual(self.client.get('/companies?demo=false&crossLocation=locality').json(),[])
        self.assertEqual(self.client.get('/companies?demo=false&locationMode=operations').json(),[])
        self.assertEqual(len(self.client.get('/companies?demo=false&locationMode=operations&siteConfidence=all').json()[0]['mapLocations']),1)
        site['status']='confirmed';self.upload('sites',[site])
        row=self.client.get('/companies?demo=false&crossLocation=locality&locationMode=operations').json()[0]
        self.assertTrue(row['crossLocality']);self.assertFalse(row['crossRegion']);self.assertEqual(row['registrationLocality'],'г. Сальск')
        site.update(region='Краснодарский край',address='Другая тестовая площадка',sourceUrl='https://example.org/second')
        self.upload('sites',[site])
        self.assertEqual(len(self.client.get('/companies?demo=false&locationMode=operations&region=Краснодарский край&crossLocation=region').json()),1)

    def test_invalid_source_does_not_partially_import(self):
        self.assertEqual(self.upload('clients',[company(),company('bad')]).status_code,422)
        self.assertEqual(self.client.get('/registry-status').json()['companies'],0)

    def test_older_snapshot_does_not_replace_latest_registry_status(self):
        self.upload('fns',[company(mspIncludedAt='2025-01-10',mspExcludedAt='2026-07-10')])
        self.upload('fns',[company(mspIncludedAt='2025-01-10')],as_of='2026-06-10')
        row=self.client.get('/companies?demo=false&registryStatus=all').json()[0]
        self.assertEqual(row['mspStatus'],'excluded');self.assertEqual(row['registryAsOf'],'2026-10-10')


if __name__=='__main__':unittest.main()
