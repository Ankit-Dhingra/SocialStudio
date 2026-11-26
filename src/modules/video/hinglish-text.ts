import { canonicalBrandText } from './brand.js';

const commonSpellings: Readonly<Record<string, string>> = {
  'मैं': 'main', 'में': 'mein', 'है': 'hai', 'हैं': 'hain', 'हूँ': 'hoon',
  'हां': 'haan', 'हाँ': 'haan', 'नहीं': 'nahi', 'मैंने': 'maine',
  'यह': 'yeh', 'वह': 'woh', 'ये': 'yeh', 'वो': 'woh', 'यहाँ': 'yahan',
  'वहाँ': 'wahan', 'जहाँ': 'jahan', 'कहाँ': 'kahan', 'क्यों': 'kyun',
  'क्योंकि': 'kyunki', 'क्या': 'kya', 'कैसे': 'kaise', 'कौन': 'kaun',
  'पहले': 'pehle', 'पहला': 'pehla', 'लिए': 'liye', 'चाहिए': 'chahiye',
  'था': 'tha', 'थी': 'thi', 'किया': 'kiya', 'लिया': 'liya', 'दिया': 'diya',
  'तुम्हारा': 'tumhara', 'तुम्हारी': 'tumhari', 'तुम्हें': 'tumhein', 'उन्हें': 'unhein',
  'आपका': 'aapka', 'आपकी': 'aapki', 'जमा': 'jama', 'पीछे': 'peeche', 'बीच': 'beech',
  'तीन': 'teen', 'बीस': 'bees', 'दिखा': 'dikha', 'दिखाए': 'dikhaye', 'लगाया': 'lagaya',
  'गया': 'gaya', 'जाएगा': 'jaayega', 'जायेगा': 'jaayega', 'आएगा': 'aayega',
  'गए': 'gaye', 'आए': 'aaye', 'हुआ': 'hua', 'हुए': 'hue',
  'जाता': 'jaata', 'जाती': 'jaati', 'होता': 'hota', 'होती': 'hoti', 'होते': 'hote', 'होगा': 'hoga',
  'करता': 'karta', 'करती': 'karti', 'रहता': 'rehta', 'रहते': 'rehte',
  'वाला': 'wala', 'वाली': 'wali', 'वाले': 'wale', 'बार': 'baar',
  'फ़ोन': 'phone', 'फोन': 'phone', 'ऐप': 'app', 'क्यू': 'queue', 'स्कैन': 'scan',
  'प्रोसेस': 'process', 'वर्कर': 'worker', 'सर्वर': 'server', 'कैश': 'cache',
  'प्रोसेसिंग': 'processing', 'अपडेट': 'update', 'अपडेट्स': 'updates', 'नेटवर्क': 'network',
  'डेटाबेस': 'database', 'रिक्वेस्ट': 'request', 'रिस्पॉन्स': 'response',
  'डेटा': 'data', 'सिस्टम': 'system', 'क्लाइंट': 'client', 'यूज़र': 'user', 'यूजर': 'user',
  'काउंटर': 'counter', 'पेमेंट': 'payment', 'मेसेज': 'message', 'मैसेज': 'message',
  'ऑनलाइन': 'online', 'ऑफलाइन': 'offline', 'ऑफ़लाइन': 'offline', 'स्टेटस': 'status',
  'लाइक': 'like', 'फॉलो': 'follow', 'फ़ॉलो': 'follow', 'शेयर': 'share', 'सेव': 'save',
  'एपीआई': 'API', 'यूपीआई': 'UPI', 'क्यूआर': 'QR', 'रेडिस': 'Redis', 'काफ्का': 'Kafka',
};

const vowels: Readonly<Record<string, string>> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ॠ': 'ri',
  'ऌ': 'li', 'ॡ': 'li', 'ऍ': 'e', 'ऎ': 'e', 'ए': 'e', 'ऐ': 'ai', 'ऑ': 'o', 'ऒ': 'o', 'ओ': 'o', 'औ': 'au',
};
const vowelSigns: Readonly<Record<string, string>> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'ॄ': 'ri', 'ॢ': 'li', 'ॣ': 'li',
  'ॅ': 'e', 'ॆ': 'e', 'े': 'e', 'ै': 'ai', 'ॉ': 'o', 'ॊ': 'o', 'ो': 'o', 'ौ': 'au',
  '्': '',
};
const consonants: Readonly<Record<string, string>> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f', 'य़': 'y', 'ऴ': 'l',
  'ऱ': 'r', 'ऩ': 'n', 'य़': 'y',
};

function romanizeWord(word: string): string {
  const normalized = word.normalize('NFC').replace(/[\u200c\u200d]/gu, '');
  if (commonSpellings[normalized]) return commonSpellings[normalized];

  const letters = Array.from(normalized);
  const syllables: Array<{ sound: string; vowel: string; inherent: boolean; ending: string }> = [];
  for (let index = 0; index < letters.length; index++) {
    const letter = letters[index];
    const withNukta = letters[index + 1] === '़' && consonants[letter + '़'];
    const consonant = withNukta || consonants[letter];
    if (consonant) {
      syllables.push({ sound: consonant, vowel: 'a', inherent: true, ending: '' });
      if (withNukta) index++;
    } else if (vowels[letter]) {
      syllables.push({ sound: '', vowel: vowels[letter], inherent: false, ending: '' });
    } else if (letter === 'ॐ') {
      syllables.push({ sound: 'Om', vowel: '', inherent: false, ending: '' });
    } else {
      const last = syllables.at(-1);
      if (!last) continue;
      if (vowelSigns[letter] !== undefined) {
        last.vowel = vowelSigns[letter];
        last.inherent = false;
      } else if (letter === 'ं' || letter === 'ँ') {
        last.ending = /^[पफबभम]$/u.test(letters[index + 1] ?? '') ? 'm' : 'n';
      } else if (letter === 'ः') {
        last.ending = 'h';
      }
    }
  }

  // Hindi usually drops an unmarked final vowel and alternating medial schwas.
  const final = syllables.at(-1);
  if (final?.inherent && !final.ending && syllables.slice(0, -1).some(syllable => syllable.vowel)) final.vowel = '';
  for (let index = syllables.length - 2; index > 0; index--) {
    const syllable = syllables[index];
    const before = syllables[index - 1];
    const after = syllables[index + 1];
    if (syllable.inherent && !syllable.ending && before.vowel && !before.ending && after.vowel && after.sound) {
      syllable.vowel = '';
    }
  }
  return syllables.map(({ sound, vowel, ending }) => sound + vowel + ending).join('');
}

export function toHinglish(text: string): string {
  return text.replace(/[।॥]/gu, '.')
    .replace(/[०-९]/gu, digit => String(digit.charCodeAt(0) - 0x0966))
    .replace(/(?:\p{Script=Devanagari}[\u200c\u200d]*)+/gu, romanizeWord);
}

// Keep URLs, file references, cue matching and entity identity intact when preparing display props.
const internalFields = new Set([
  'id', 'sceneId', 'entity', 'source', 'target', 'from', 'to', 'asset', 'beatAsset', 'lottieAsset',
  'audioSrc', 'bgmSrc', 'src', 'url', 'publicPostUrl', 'cue', 'cues', 'evidence', 'continuity',
  'action', 'actionCue', 'openCue', 'scanCue', 'takeawayCue', 'spokenNarration',
]);

export function localizeVideoText<T>(props: T): T {
  if (typeof props === 'string') return toHinglish(canonicalBrandText(props)) as T;
  if (Array.isArray(props)) return props.map(item => localizeVideoText(item)) as T;
  if (!props || typeof props !== 'object') return props;
  return Object.fromEntries(Object.entries(props).map(([field, value]) =>
    [field, internalFields.has(field) ? value : localizeVideoText(value)],
  )) as T;
}

