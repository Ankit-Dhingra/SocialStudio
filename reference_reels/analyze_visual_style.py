import os, sys, json, base64, urllib.request

sys.stdout.reconfigure(encoding='utf-8')

gemini_key = None
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('GEMINI_API_KEY='):
            gemini_key = line.strip().split('=', 1)[1].strip()
            break

def analyze_frames(image_paths):
    parts = [{"text": "Analyze the visual composition and motion graphics in these reference Instagram reels. Describe: 1. Is there a human face / cutout / talking head? 2. What background style (3D, dark canvas, isometric map, glowing grid)? 3. What animated diagram style (SVG nodes, phone UI mockups, real-world illustrations like milk carton, Maggi stall, delivery rider, glowing cables, HUD chips)? 4. Why does this look like an engaging 'animated story' rather than boring PowerPoint slides with blue background? Be specific."}]
    for p in image_paths:
        with open(p, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
            parts.append({
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": b64
                }
            })
            
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": 0.2, "thinkingConfig": {"thinkingBudget": 0}}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        d = json.loads(resp.read().decode('utf-8'))
        return d['candidates'][0]['content']['parts'][0]['text']

print(analyze_frames([
    'reference_reels/extracted_visuals/fewshot_5s.jpg',
    'reference_reels/extracted_visuals/fewshot_45s.jpg',
    'reference_reels/extracted_visuals/devmonk_20s.jpg',
    'reference_reels/extracted_visuals/codewithpt_45s.jpg'
]))
