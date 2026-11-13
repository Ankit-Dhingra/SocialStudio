import sys, json

sys.stdout.reconfigure(encoding='utf-8')

def analyze(name, label, creator, topic):
    with open(f'reference_reels/{name}_transcript.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    segments = data['segments']
    text = data['text']
    
    # Calculate word count, duration
    words = text.split()
    total_words = len(words)
    duration = data.get('duration', segments[-1]['end'])
    wps = total_words / duration
    
    # Gaps / Pauses
    pauses = []
    for i in range(len(segments)-1):
        gap = segments[i+1]['start'] - segments[i]['end']
        if gap > 0.25:
            pauses.append({
                'at_sec': round(segments[i]['end'], 1),
                'gap_sec': round(gap, 2),
                'before': segments[i]['text'].strip(),
                'after': segments[i+1]['text'].strip()
            })
            
    # Print summary
    print(f"==================================================")
    print(f"{label}: {creator} - {topic}")
    print(f"Duration: {duration:.1f}s | Words: {total_words} | Pacing: {wps:.2f} words/sec (~{wps*60:.0f} WPM)")
    print(f"Total Segments: {len(segments)}")
    print("Pauses (>0.25s):")
    for p in pauses:
        print(f"  - At {p['at_sec']}s (duration {p['gap_sec']}s): '{p['before']}' -> '{p['after']}'")
    print("\nFull Timestamped Text:")
    for s in segments:
        print(f"[{s['start']:05.1f}s - {s['end']:05.1f}s] {s['text'].strip()}")
    print("\n")

analyze('reel1', 'REEL_1', '@devmonk.preetam (DevMonk)', 'UPI Payment Flow & Deferred Net Settlement (DNS)')
analyze('reel2', 'REEL_2', '@fewshot.studio (Few Shot Studio)', 'Quick Commerce (10-Minute Delivery / Dark Store Architecture)')
analyze('reel3', 'REEL_3', '@codewith.pt (CodeWith.pt)', 'OTP & Notification System Design')
