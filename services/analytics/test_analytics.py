"""Run with python -m unittest -v in an isolated temporary database."""
import csv
import io
import os
import tempfile
import unittest
import zipfile

temporary = tempfile.TemporaryDirectory()
os.environ['DATA_DIR'] = temporary.name
from fastapi.testclient import TestClient
from main import app


class AnalyticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.parameters = dict(type='ИТ-инфраструктура', region='Ростовская область', units=50, months=6, financing='Единовременно', equipment=1400000, software=350000, labor=500000, unique=False, urgent=False, customer='Тестовый заказчик')

    def test_filters_and_insights_consistent(self):
        query = {'region': 'Ростовская область', 'client': 'false', 'minRevenue': 500, 'minGrowth': 10}
        rows = self.client.get('/companies', params=query).json()
        insight = self.client.get('/insights', params=query).json()
        self.assertTrue(rows)
        self.assertEqual(len(rows), insight['companies'])
        self.assertTrue(all(not r['client'] and r['revenue'] >= 500 and r['growth'] >= 10 for r in rows))
        self.assertAlmostEqual(sum(r['revenue'] for r in rows), insight['revenue'])

    def test_price_floor_and_monotonicity(self):
        normal = self.client.post('/estimate', json=self.parameters).json()
        urgent = self.client.post('/estimate', json=dict(self.parameters, urgent=True)).json()
        self.assertGreaterEqual(normal['minimum'], normal['cost']/.9-1)
        self.assertLessEqual(normal['minimum'], normal['optimum'])
        self.assertLess(normal['optimum'], normal['maximum'])
        self.assertGreater(urgent['optimum'], normal['optimum'])
        self.assertTrue(normal['demo'])
        invalid = self.client.post('/estimate', json=dict(self.parameters, units=0))
        self.assertEqual(invalid.status_code, 422)

    def test_map_zone_restricts_list_and_export(self):
        rows = self.client.get('/companies?demo=true').json()
        company = rows[0]
        bounds = f'{company["lat"]-.001},{company["lon"]-.001},{company["lat"]+.001},{company["lon"]+.001}'
        selected = self.client.get('/companies', params={'bounds':bounds, 'demo':'true'}).json()
        self.assertEqual([r['id'] for r in selected], [company['id']])
        exported = self.client.get('/export/companies', params={'bounds':bounds, 'demo':'true'}).content.decode('utf-8-sig')
        self.assertEqual(len(list(csv.DictReader(io.StringIO(exported),delimiter=';'))),1)
        self.assertEqual(self.client.get('/companies?bounds=bad').status_code,422)

    def test_export_word_and_csv(self):
        response = self.client.post('/estimate/export/docx', json=self.parameters)
        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            xml = archive.read('word/document.xml').decode()
            self.assertIn('Тестовый заказчик', xml)
            self.assertIn('демонстрационной истории', xml)
        for format in ['doc', 'csv']:
            self.assertEqual(self.client.post('/estimate/export/'+format, json=self.parameters).status_code, 200)
        exported = self.client.get('/export/companies?region=Ростовская область&stage=Запуск&crm=true')
        rows = list(csv.DictReader(io.StringIO(exported.content.decode('utf-8-sig')), delimiter=';'))
        self.assertEqual(len(rows), 12)
        self.assertIn('COMPANY_INN', rows[0])

    def test_import_is_atomic_and_idempotent(self):
        sample = self.client.get('/companies').json()[0]
        sample.update(name='=HYPERLINK("bad")', inn='7701234567', source='Тест ФНС', demo=False)
        columns = list(sample)
        def encode(rows):
            buffer = io.StringIO()
            writer = csv.DictWriter(buffer, columns, delimiter=';')
            writer.writeheader()
            writer.writerows(rows)
            return buffer.getvalue().encode()
        before = len(self.client.get('/companies').json())
        invalid = dict(sample, inn='bad')
        self.assertEqual(self.client.post('/import/companies', content=encode([sample, invalid])).status_code, 422)
        self.assertEqual(len(self.client.get('/companies').json()), before)
        body = encode([sample])
        self.assertEqual(self.client.post('/import/companies', content=body).status_code, 200)
        self.assertEqual(self.client.post('/import/companies', content=body).status_code, 200)
        self.assertEqual(len(self.client.get('/companies').json()), before+1)
        real = self.client.get('/companies?demo=false').json()
        self.assertEqual(real[0]['source'], 'Тест ФНС')
        exported = self.client.get('/export/companies?demo=false').text
        self.assertIn("'=HYPERLINK", exported)
        invalid_number = dict(sample, revenue='nan')
        self.assertEqual(self.client.post('/import/companies', content=encode([invalid_number])).status_code, 422)

    def test_real_deals_replace_demo_analogs(self):
        sample = dict(id='',name='Реальная тестовая сделка',type='ИТ-инфраструктура',region='Ростовская область',units=50,months=6,price=4000000,cost=2500000,date='2026-09-01',source='Тестовая CRM')
        buffer = io.StringIO();writer = csv.DictWriter(buffer, list(sample), delimiter=';');writer.writeheader();writer.writerow(sample)
        self.assertEqual(self.client.post('/import/deals', content=buffer.getvalue().encode()).status_code, 200)
        result = self.client.post('/estimate', json=self.parameters).json()
        self.assertFalse(result['demo'])
        self.assertEqual(len(result['analogs']), 1)
        self.assertTrue(all(not d['demo'] for d in result['analogs']))


if __name__ == '__main__':
    unittest.main()
