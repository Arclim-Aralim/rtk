import unittest
from geocoding import normalize_name, locate, geocode_record


def place(id,name,kind='locality',district='',primary=None):
    return dict(id=id,name=name,keys=[normalize_name(name)],primaryKeys=[normalize_name(primary or name)],admin1='61',admin2=district,kind=kind,lat=47+int(id)/100,lon=39)


class GeocodingTests(unittest.TestCase):
    def setUp(self):
        self.data=dict(regions={'Ростовская область':'61'},entries=[place('1','Ростов-на-Дону'),place('2','Азовский район','district'),place('3','Миллерово',district='north'),place('4','Миллерово',district='south'),place('5','Северный район','district','north')])

    def test_locality_normalization_preserves_names(self):
        self.assertEqual(normalize_name('г. Ростов-на-Дону'),normalize_name('Rostov-na-Donu'))
        self.assertEqual(normalize_name('Акса́йский райо́н'),normalize_name('Аксайский р-н'))

    def test_locality_is_approximate_not_an_office(self):
        row=geocode_record(dict(region='Ростовская область',registrationLocality='г. Ростов-на-Дону',lat=None,lon=None),'companies',self.data)
        self.assertEqual(row['geoAccuracy'],'locality');self.assertEqual(row['geoMatchStatus'],'matched')
        self.assertNotIn('operatingSites',row)

    def test_ambiguous_match_is_not_guessed(self):
        result=locate('Ростовская область','Миллерово',gazetteer=self.data)
        self.assertEqual(result['status'],'ambiguous');self.assertNotIn('lat',result)
        result=locate('Ростовская область','Миллерово','Северный район',self.data)
        self.assertEqual(result['status'],'matched');self.assertEqual(result['lat'],47.03)

    def test_district_point_is_labeled_and_exact_points_preserved(self):
        row=geocode_record(dict(region='Ростовская область',municipality='Азовский район',lat=None,lon=None),'projects',self.data)
        self.assertEqual(row['geoAccuracy'],'district')
        row=geocode_record(dict(region='Ростовская область',registrationLocality='Ростов-на-Дону',lat=1.2,lon=2.3,geoAccuracy='provided'),'companies',self.data)
        self.assertEqual(row['lat'],1.2);self.assertEqual(row['geoAccuracy'],'provided')


if __name__=='__main__':unittest.main()
