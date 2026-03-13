import urllib.request
import urllib.error
import json

req = urllib.request.Request(
    'http://localhost:8000/api/concept-map',
    data=b'{"concept": "rububiyet", "max_nodes": 15}',
    headers={'Content-Type': 'application/json'}
)

try:
    res = urllib.request.urlopen(req)
    print(res.read().decode())
except urllib.error.HTTPError as e:
    print(e.read().decode())
except Exception as e:
    print(str(e))
