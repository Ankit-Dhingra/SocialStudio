import 'dotenv/config';
import fs from 'node:fs';
import OpenAI from 'openai';

async function main() {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || '',
    baseURL: 'https://api.groq.com/openai/v1',
  });

  console.log('Sending audio to Groq Whisper...');
  const res = await client.audio.transcriptions.create({
    file: fs.createReadStream('reference_reels/sysdesign_audio.mp3'),
    model: 'whisper-large-v3',
    response_format: 'verbose_json',
  });

  console.log('=== EXACT TRANSCRIPT OF sys.design.101 REEL ===');
  console.log(res.text);
  fs.writeFileSync('reference_reels/sysdesign_exact_transcript.json', JSON.stringify(res, null, 2));
}

main().catch(console.error);
