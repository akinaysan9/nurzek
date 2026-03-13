import requests
import json
import sys

def test_v2_stream():
    print("Testing NurZeka V2 API (SSE Protocol)...")
    url = "http://localhost:8000/api/search"
    payload = {"question": "İman insana ne kazandırır?"} # Requested test question
    
    try:
        with requests.post(url, json=payload, stream=True) as r:
            print(f"Status Code: {r.status_code}")
            if r.status_code == 200:
                print("Stream started... Tokens:")
                buffer = ""
                for line in r.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        if decoded_line.startswith("data: "):
                            data_str = decoded_line[6:]
                            if data_str == "[DONE]":
                                print("\n[STREAM COMPLETE]")
                                break
                            try:
                                data = json.loads(data_str)
                                if "token" in data:
                                    token = data["token"]
                                    sys.stdout.write(token)
                                    sys.stdout.flush()
                                    buffer += token
                                elif "error" in data:
                                    print(f"\n[ERROR]: {data['error']}")
                            except json.JSONDecodeError:
                                print(f"\n[Valid JSON Error]: {data_str}")
            else:
                print(r.text)
    except Exception as e:
        print(f"Test Failed: {e}")

if __name__ == "__main__":
    test_v2_stream()
