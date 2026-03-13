import urllib.request, json
req = urllib.request.Request(
    'http://localhost:8000/api/concept-map',
    data=json.dumps({'concept': 'rahmet'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    res = urllib.request.urlopen(req)
    print(json.loads(res.read().decode('utf-8')))
except Exception as e:
    import traceback
    print('HATA:', e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
