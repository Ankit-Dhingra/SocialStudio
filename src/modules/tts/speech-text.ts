const terms: Array<[RegExp, string, string]> = [
  [/\bO\s*\(\s*1\s*\)/gi, 'big oh one', 'बिग ओ वन'],
  [/\bRedis\b/gi, 'Rediss', 'रेडिस'],
  [/\bKafka\b/gi, 'Kahfka', 'काफ्का'],
  [/\bSQL\b/gi, 'ess cue ell', 'एस क्यू एल'],
  [/\bTTL\b/gi, 'tee tee ell', 'टी टी एल'],
  [/\bH3\b/gi, 'aitch three', 'एच थ्री'],
  [/\bSET[-\s]*NX\b/gi, 'set en ex', 'सेट एन एक्स'],
  [/\bsame\b/gi, 'same', 'सेम'],
  [/\bZomato\b/gi, 'Zomato', 'जोमैटो'],
  [/\bGPS\b/gi, 'G P S', 'जीपीएस'],
  [/\bAPI\b/gi, 'A P I', 'एपीआई'],
  [/\bAPIs\b/gi, 'A P Is', 'एपीआईज़'],
  [/\bSpatial\b/gi, 'Spatial', 'स्पेशल'],
  [/\bIndexing\b/gi, 'Indexing', 'इंडेक्सिंग'],
  [/\bPricing Engine\b/gi, 'Pricing Engine', 'प्राइसिंग इंजन'],
  [/\bBehind The Tech\b/gi, 'Behind The Tech', 'बिहाइंड द टेक'],
  [/\bheartbeat\b/gi, 'heartbeat', 'हार्टबीट'],
  [/\btimestamp\b/gi, 'timestamp', 'टाइमस्टैम्प'],
  [/\btimestamps\b/gi, 'timestamps', 'टाइमस्टैम्प्स'],
  [/\boffline\b/gi, 'offline', 'ऑफलाइन'],
  [/\bonline\b/gi, 'online', 'ऑनलाइन'],
  [/\bcache\b/gi, 'cache', 'कैश'],
  [/\bdatabase\b/gi, 'database', 'डेटाबेस'],
  [/\bdatabases\b/gi, 'databases', 'डेटाबेसेज़'],
  [/\bserver\b/gi, 'server', 'सर्वर'],
  [/\bservers\b/gi, 'servers', 'सर्वर्स'],
  [/\bstatus\b/gi, 'status', 'स्टेटस'],
  [/\border\b/gi, 'order', 'ऑर्डर'],
  [/\borders\b/gi, 'orders', 'ऑर्डर्स'],
  [/\brider\b/gi, 'rider', 'राइडर'],
  [/\briders\b/gi, 'riders', 'राइडर्स'],
  [/\bexpensive\b/gi, 'expensive', 'एक्सपेंसिव'],
  [/\blatency\b/gi, 'latency', 'लेटेंसी'],
  [/\bthroughput\b/gi, 'throughput', 'थ्रूपुट'],
];

export function prepareSpeech(text: string, hindi: boolean): string {
  let speech = text
    // Handle currencies cleanly so neural TTS doesn't stumble or swallow numbers
    .replace(/₹\s*(\d+)/g, (_m, num) => `${num} रुपये`)
    .replace(/₹/g, ' रुपये ')
    .replace(/\$\s*(\d+)/g, (_m, num) => `${num} डॉलर्स`)
    .replace(/(\d+)%/g, (_m, num) => `${num} प्रतिशत`)
    // Remove scene/act/speaker prefixes (e.g., "Scene 1:", "Act 2 -", "Voiceover:", "VO:")
    .replace(/^(?:Scene\s*\d+|Act\s*\d+|Voiceover|VO|Narrator)\s*[-—:]\s*/gi, '')
    // Remove inline bracketed visual or audio cues like [Visual: ...], [SFX: ...], (Audio: ...)
    .replace(/\[(?:Visual|SFX|Audio|Effect|Sound|Animation)[^\]]*\]/gi, '')
    .replace(/\((?:Visual|SFX|Audio|Effect|Sound|Animation)[^)]*\)/gi, '')
    // Remove SSML breaks / tags
    .replace(/<break\b[^>]*\/?>/gi, ', ')
    .replace(/<\/(?:s|p)>/gi, '. ')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    // Remove markdown code fences and backticks
    .replace(/^```(?:[\w-]+)?[^\S\r\n]*$/gm, '')
    .replace(/```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/`/g, '')
    // Remove markdown formatting: bold, italic, headings
    .replace(/\*{1,2}/g, '')
    .replace(/^#+\s+/gm, '')
    // Clean up quotes around words
    .replace(/["'“”‘’]/g, '')
    // Replace ellipsis and dashes with pause commas
    .replace(/\.{2,}|…|[—–]/g, ', ')
    .replace(/([.!?।])\s*[,\.]+/g, '$1')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/\s+([,.!?।])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, english, devanagari] of terms) {
    speech = speech.replace(pattern, hindi ? devanagari : english);
  }
  return speech;
}

// Prefer complete sentences, then whitespace at the provider's request limit.
export function speechChunks(text: string, limit = 1500): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const prefix = rest.slice(0, limit);
    const boundary = Array.from(prefix.matchAll(/[.!?।](?=\s)/g)).at(-1)?.index;
    const space = prefix.search(/\s+\S*$/);
    const end = boundary !== undefined ? boundary + 1 : space > 0 ? space : limit;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
