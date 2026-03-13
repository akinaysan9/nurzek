import urllib.request
import json
req = urllib.request.Request(
    'http://localhost:8000/api/concept-info',
    data=json.dumps({'concept': 'yedinci mesele'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode('utf-8'))
    for occ in data.get('occurrences', []):
        if 'yedinci-mesele' in occ['chapter_slug'] or 'yedinci-mesele' in occ['book_slug']:
            print(f"book_slug: {occ['book_slug']}, chapter_slug: {occ['chapter_slug']}, orig_kitap: {occ['kitap']}")
except Exception as e:
    print('HATA:', e)
