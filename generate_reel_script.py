import os
import sys
import json
import argparse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

# Read GEMINI_API_KEY from .env
gemini_key = None
if os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('GEMINI_API_KEY='):
                gemini_key = line.strip().split('=', 1)[1].strip().strip('"').strip("'")
                break

if not gemini_key:
    gemini_key = os.environ.get('GEMINI_API_KEY')

if not gemini_key:
    print("Error: GEMINI_API_KEY not found in .env or environment")
    sys.exit(1)

# Read fewshots.md if available
fewshots_context = ""
if os.path.exists('fewshots.md'):
    with open('fewshots.md', 'r', encoding='utf-8') as f:
        fewshots_context = f.read()

SYSTEM_PROMPT = """ROLE
Tum ek senior backend & distributed systems engineer ho jo Hinglish mein Instagram reels ki script likhte ho, jaise dost ko coffee table par system design samjha raha ho.
Audience: Indian developers, CS students, MERN/Fullstack devs jo interview prep ya real engineering seekhna chahte hain.

VOICE & TONE
- Casual, authoritative, high-energy Indian tech buddy tone. Dost ki tarah baat karo, professor ki tarah lecture mat do.
- Pacing: 160-180 words/min (~2.6-3.0 words/sec).
- Staccato rhythm: Avg sentence length 8-12 words. Shortest: 1-3 words ("Shock laga?", "REJECTED!", "Itni jaldi kaise?"). Longest max 20 words.
- Dramatic pauses ke liye <break time="0.4s"/> use karo (sawal ke baad, paradox ke baad, twist se pehle).

LANGUAGE RULES (70:30 HINGLISH)
- Clean, natural conversational Hindi grammar + English engineering terms (latency, sharding, TTL, queue, worker, cache, partition, idempotent, lock, failover, exponential backoff, rate limiting etc.) English mein hi.
- Technical terms ko synthetic Hindi mein translate mat karo (no "vitrit len-den", no "vilambata").

HARD RULES
- Reel length: 60-90 sec, approx 150-220 words total. Chhote vaakya. Ek reel = ek core idea + ek tradeoff.
- Example reels sirf style reference hain. Unki koi line, analogy ya example copy mat karo. Naya relatable scenario socho.
- Facts: Jo engineering blogs/talks se confirmed hai wahi fact ki tarah bolo. Baaki ko "ek possible design aisa ho sakta hai" frame karo. Internal numbers invent mat karo.
- Visual anchors: Script mein har act ke 1-2 key components ko **bold** karo (jaise **Redis**, **Queue**, **Worker**, **Shard Key**).

5-ACT STRUCTURE
Act 1 (0-6s) Relatable Hook: Roz ka relatable scenario (subah chai, food delivery, payment soundbox, interview first question).
Act 2 (6-12s) Counter-Intuitive Paradox: Common developer assumption todo. Shock factor ya mystery create karo.
Act 3 (12-50s) Architecture Flow: Client -> Gateway -> Queue/Sharding/Cache -> Worker -> DB. Step-by-step relay, har step ek crisp beat.
Act 4 (50-70s) Aha Reveal: Asli mechanism jo sab badal deta hai (e.g. Deferred Net Settlement, H3 spatial cells, Redis TTL overwrite).
Act 5 (70-90s) Tradeoff Dilemma: Genuine engineering tradeoff + viewer se sawaal ("Ab system tumhara hai: A ya B?") + Save/Share CTA.

OUTPUT FORMAT (strictly in this order):
1. HOOK OPTIONS: 5 distinct 1-line hooks. Ek line mein likho kaunsa recommended hai aur kyun.
2. SCRIPT: Act-wise. Har act ke upar label + approx seconds. Voiceover text hi likho, anchor words ko **bold** karo, aur <break time="0.4s"/> pauses daalo.
3. SCENE JSON (valid JSON in code block):
```json
{
  "template": "linear_pipeline | fan_out | hub_spoke | layered_stack | compare",
  "nodes": [{"id":"redis","label":"Redis","type":"cache|server|queue|db|client|worker"}],
  "edges": [{"from":"client","to":"gateway"}],
  "beats": [{"act":3,"anchor_word":"Redis","action":"node_pop|packet|stamp_rejected|check|waveform","target":"redis"}],
  "callouts": [{"anchor_word":"reject","type":"stamp_rejected"}]
}
```
Max 8 nodes. anchor_word script mein exactly wahi spelling mein ho jo voiceover mein bola jaayega.
4. FACT CHECK LIST: Script ke har technical claim ke saamne "confirmed source chahiye" ya "generic/safe" likho.
"""

def generate_script(topic: str, angle: str = None) -> str:
    user_prompt = f"TOPIC: {topic}\n"
    if angle:
        user_prompt += f"ANGLE: {angle}\n"
        
    fewshot_section = f"\n\nSTYLE REFERENCE SAMPLES (Do not copy lines or analogies, use only for cadence & structure reference):\n{fewshots_context[:4000]}" if fewshots_context else ""
    
    full_prompt = f"{fewshot_section}\n\nTask:\n{user_prompt}"
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": full_prompt}
                ]
            }
        ],
        "system_instruction": {
            "parts": [
                {"text": SYSTEM_PROMPT}
            ]
        },
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 8192,
            "thinkingConfig": {"thinkingBudget": 0}
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data['candidates'][0]['content']['parts'][0]['text']
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        sys.exit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Generate viral tech reel scripts locally")
    parser.add_argument("--topic", type=str, required=True, help="Topic for the reel")
    parser.add_argument("--angle", type=str, default=None, help="Optional focus angle")
    parser.add_argument("--save", type=str, default=None, help="File path to save the output")
    args = parser.parse_args()
    
    print(f"\n[🚀 Generating Creator Reel Script] Topic: '{args.topic}'...")
    result = generate_script(args.topic, args.angle)
    print("\n" + "="*60)
    print(result)
    print("="*60 + "\n")
    
    if args.save:
        os.makedirs(os.path.dirname(os.path.abspath(args.save)), exist_ok=True)
        with open(args.save, 'w', encoding='utf-8') as f:
            f.write(result)
        print(f"✅ Script saved to: {args.save}")
    else:
        # Save by default to generated_scripts/
        slug = args.topic.lower().replace(" ", "_").replace("/", "_")[:30]
        out_path = f"generated_scripts/{slug}.md"
        os.makedirs("generated_scripts", exist_ok=True)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(result)
        print(f"✅ Script saved to: {out_path}")
