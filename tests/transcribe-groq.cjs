const fs = require('fs');

async function main() {
  const buffer = fs.readFileSync('reference_reels/sysdesign_audio.mp3');
  const blob = new Blob([buffer], { type: 'audio/mp3' });
  const formData = new FormData();
  formData.append('file', blob, 'audio.mp3');
  formData.append('model', 'whisper-large-v3');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY || ''}`,
    },
    body: formData,
  });

  const data = await res.json();
  console.log('=== EXACT TRANSCRIPT OF sys.design.101 ===');
  console.log(data.text);
  fs.writeFileSync('reference_reels/sysdesign_transcript.txt', data.text, 'utf-8');
}

main().catch(console.error);
