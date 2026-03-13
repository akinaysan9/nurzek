import os

file_path = r"frontend/src/style.css"

try:
    with open(file_path, 'rb') as f:
        content = f.read()
    
    # Try to decode and re-encode as UTF-8
    decoded_content = None
    for enc in ['utf-16', 'utf-16-le', 'utf-8', 'latin-1']:
        try:
            decoded_content = content.decode(enc)
            print(f"Successfully decoded with {enc}")
            break
        except:
            continue
            
    if decoded_content:
        # Check if it's already sensible (not many weird characters)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(decoded_content)
        print("Successfully converted to UTF-8")
    else:
        print("Could not decode file content")
except Exception as e:
    print(f"Error: {e}")
