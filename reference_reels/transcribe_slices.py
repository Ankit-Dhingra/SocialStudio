import os, sys, json, subprocess
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

# Read GROQ_API_KEY from .env
api_key = None
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('GROQ_API_KEY='):
            api_key = line.strip().split('=', 1)[1].strip().strip('"').strip("'")
            break

if not api_key:
    print("GROQ_API_KEY not found in .env")
    sys.exit(1)

slices = [
    ("reel1", "reel1_slice.mp3", 42.0, 16.0),
    ("reel2", "reel2_slice.mp3", 73.0, 15.0),
    ("reel3", "reel3_slice.mp3", 75.0, 15.0),
]

for orig, out_slice, ss, t in slices:
    cmd = f'ffmpeg -y -ss {ss} -t {t} -i reference_reels/{orig}.mp3 -acodec libmp3lame reference_reels/{out_slice}'
    subprocess.run(cmd, shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    with open(f"reference_reels/{out_slice}", "rb") as f:
        file_bytes = f.read()
        
    body = bytearray()
    # model field
    body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n'.encode('utf-8'))
    # response_format
    body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n'.encode('utf-8'))
    # file field
    body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{out_slice}"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode('utf-8'))
    body.extend(file_bytes)
    body.extend(f'\r\n--{boundary}--\r\n'.encode('utf-8'))
    
    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        data=bytes(body),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': f'multipart/form-data; boundary={boundary}'
        }
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"=== {orig} [{ss}s - {ss+t}s] ===")
            print(data.get('text', ''))
            for s in data.get('segments', []):
                print(f"  [{s['start']+ss:.1f} - {s['end']+ss:.1f}] {s['text']}")
    except Exception as e:
        print(f"Error on {orig}: {e}")
