import requests
import json
import sys

# Test Python API standalone
def test_python_api():
    print("Testing Python API directly...")
    url = "http://localhost:8000/ask"
    payload = {"query": "Namaz neden kılınır?"}
    try:
        with requests.post(url, json=payload, stream=True) as r:
            print(f"Status Code: {r.status_code}")
            if r.status_code == 200:
                print("Stream started...")
                for chunk in r.iter_content(chunk_size=None):
                    if chunk:
                        sys.stdout.write(chunk.decode('utf-8'))
                        sys.stdout.flush()
                print("\nStream finished.")
            else:
                print(r.text)
    except Exception as e:
        print(f"Python API Failed: {e}")

if __name__ == "__main__":
    test_python_api()
