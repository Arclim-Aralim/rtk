"""Integration check for an isolated QA account. Uses only Python standard library."""
import base64
import csv
import hashlib
import hmac
import http.cookiejar
import io
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request

base = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5080'
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def request(path, body=None, method=None, content_type='application/json', csrf=True):
    headers={'Content-Type':content_type}
    if csrf: headers['X-Requested-With']='RT'
    data=body if isinstance(body,bytes) else json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(base+'/api/'+path,data=data,headers=headers,method=method)
    try:
        with client.open(req,timeout=30) as r: return r.status,r.read(),r.headers
    except urllib.error.HTTPError as e: return e.code,e.read(),e.headers


def otp(secret,counter):
    digest=hmac.new(base64.b32decode(secret),struct.pack('>Q',counter),hashlib.sha1).digest()
    offset=digest[-1]&15
    return str((int.from_bytes(digest[offset:offset+4],'big')&0x7fffffff)%1000000).zfill(6)


assert request('companies')[0]==401
assert request('auth/login',{},csrf=False)[0]==403
assert request('auth/login',{'username':'nobody','password':'wrong'})[0]==401
username=os.environ.get('QA_USER','admin')
password=os.environ['QA_PASSWORD']
status,body,_=request('auth/login',{'username':username,'password':password})
assert status==200,body
challenge=json.loads(body)
secret=challenge.get('secret') or os.environ['QA_TOTP_SECRET']
assert request('auth/verify',{'challenge':challenge['challenge'],'code':'bad'})[0]==401
counter=int(time.time())//30
status,body,headers=request('auth/verify',{'challenge':challenge['challenge'],'code':otp(secret,counter)})
assert status==200,body
assert 'httponly' in headers.get('Set-Cookie','').lower() and 'samesite=strict' in headers.get('Set-Cookie','').lower()
assert request('auth/me')[0]==200
assert request('companies')[0]==200
assert request('data-status')[0]==200
assert request('not-a-route')[0]==404
# Reuse the same TOTP in another login challenge: it must be rejected.
status,body,_=request('auth/login',{'username':username,'password':password})
challenge2=json.loads(body)
assert request('auth/verify',{'challenge':challenge2['challenge'],'code':otp(secret,counter)})[0]==401
# New imported projects should trigger the newly created subscription only once.
status,body,_=request('subscriptions',{'region':'Ростовская область','industry':'','need':'','stage':''})
assert status==200,body
subscription=json.loads(body)
assert not json.loads(request('notifications')[1])
project={'name':'Сквозная проверка '+str(time.time_ns()),'initiator':'QA','region':'Ростовская область','industry':'Промышленность','stage':'Проектирование','need':'АСУ ТП','investment':100,'date':'2026-12-01','lat':47.2,'lon':39.7,'source':'QA isolated fixture','sourceUrl':''}
csv_buffer=io.StringIO();writer=csv.DictWriter(csv_buffer,list(project),delimiter=';');writer.writeheader();writer.writerow(project)
assert request('import/projects',csv_buffer.getvalue().encode(),content_type='text/csv')[0]==200
assert len(json.loads(request('notifications')[1]))==1
assert request('notifications/read',{})[0]==200
assert not json.loads(request('notifications')[1])
assert request('subscriptions/'+subscription['id'],method='DELETE')[0]==204
assert request('auth/logout',{})[0]==200
assert request('companies')[0]==401
print('PASS: authentication, TOTP replay protection, CSRF, session cookie, proxy, project import, subscriptions, notifications, logout')
