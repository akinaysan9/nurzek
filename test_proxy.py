import urllib.request
import urllib.error
import json

req = urllib.request.Request(
    'http://localhost:3001/api/concept-map',
    data=b'{"concept": "rububiyet"}',
    headers={'Content-Type': 'application/json'}
)

try:
    res = urllib.request.urlopen(req)
    print("SUCCESS", res.read().decode()[:100])
except urllib.error.HTTPError as e:
    print("HTTP ERROR", e.code, e.read().decode())
except Exception as e:
    print("ERROR", str(e))
