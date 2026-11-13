import os, sys, json, base64, urllib.request

sys.stdout.reconfigure(encoding='utf-8')

gemini_key = None
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('GEMINI_API_KEY='):
            gemini_key = line.strip().split('=', 1)[1].strip()
            break

def transcribe_audio_gemini(audio_path, prompt):
    with open(audio_path, 'rb') as f:
        audio_b64 = base64.b64encode(f.read()).decode('utf-8')
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "audio/mp3", "data": audio_b64}}
            ]
        }]
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        return result['candidates'][0]['content']['parts'][0]['text']

print("=== Reel 1 slice ===")
print(transcribe_audio_gemini('reference_reels/reel1_slice.mp3', 'Transcribe verbatim what the speaker says in Hinglish, word for word.'))

print("=== Reel 2 slice ===")
print(transcribe_audio_gemini('reference_reels/reel2_slice.mp3', 'Transcribe verbatim what the speaker says in Hinglish, word for word.'))

print("=== Reel 3 slice ===")
print(transcribe_audio_gemini('reference_reels/reel3_slice.mp3', 'Transcribe verbatim what the speaker says in Hinglish, word for word.'))
