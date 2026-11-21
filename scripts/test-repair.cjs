const fs = require('fs');
const s = JSON.parse(fs.readFileSync('media/sessions/session_1795024512992_cjqay.json', 'utf8'));
const sec4 = s.currentMarkdown.slice(s.currentMarkdown.search(/###?\s*4\.?\s*(?:REMOTION|Remotion)/i));
const firstFence = sec4.indexOf('```');
const jsonStart = sec4.indexOf('\n', firstFence) + 1;
const lastFence = sec4.lastIndexOf('```');
const rawJson = sec4.slice(jsonStart, lastFence).trim();

function repairJson(jsonStr) {
  // Strategy 1: Replace unescaped quotes inside single-line key-value pairs
  const lines = jsonStr.split('\n');
  const fixedLines = lines.map(line => {
    const match = line.match(/^(\s*"[^"]+"\s*:\s*")(.*)("[\s,]*)$/);
    if (!match) return line;
    const [, prefix, middle, suffix] = match;
    const fixedMiddle = middle.replace(/(?<!\\)"/g, '\\"');
    return prefix + fixedMiddle + suffix;
  });
  return fixedLines.join('\n');
}

try {
  const fixed = repairJson(rawJson);
  const parsed = JSON.parse(fixed);
  console.log('SUCCESS! Parsed scene count:', parsed.scenes.length);
  console.log('Scene types:', parsed.scenes.map(sc => sc.type));
} catch (e) {
  console.error('Failed:', e.message);
}
