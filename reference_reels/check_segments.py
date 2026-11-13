import json, sys
sys.stdout.reconfigure(encoding='utf-8')

for name in ['reel1', 'reel2', 'reel3']:
    with open(f'reference_reels/{name}_transcript.json', 'r', encoding='utf-8') as f:
        d = json.load(f)
    print(f'*** {name} words check ***')
    words = d.get('words', [])
    print(f"Total words in word-timestamps: {len(words)}")
