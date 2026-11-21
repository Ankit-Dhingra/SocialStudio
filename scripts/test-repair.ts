import fs from 'node:fs';

const session = JSON.parse(fs.readFileSync('media/sessions/session_1795068591407_k21m0.json', 'utf8'));
const sec4Match = session.currentMarkdown.match(/(?:###?\s*4\.?\s*(?:REMOTION\s*SCENE\s*JSON|Remotion\s*Scene\s*JSON))([\s\S]*?)(?:###?\s*5|$)/i);
const rawSec4 = sec4Match[1];
const codeMatch = rawSec4.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
const jsonCandidate = codeMatch ? codeMatch[1].trim() : rawSec4.trim();

function repairTruncatedJson(raw: string): any {
  if (!raw || !raw.trim()) return null;
  let str = raw.trim();
  str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(str);
  } catch {}

  // Single-line unescaped quotes repair
  let repaired = str.split('\n').map(line => {
    const match = line.match(/^(\s*"[^"]+"\s*:\s*")(.*)("[\s,]*)$/);
    if (!match) return line;
    const [, prefix, middle, suffix] = match;
    const fixedMiddle = middle.replace(/(?<!\\)"/g, '\\"');
    return prefix + fixedMiddle + suffix;
  }).join('\n');

  try {
    return JSON.parse(repaired);
  } catch {}

  // Stack-based bracket & string closure
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') {
        stack.push('}');
      } else if (ch === '[') {
        stack.push(']');
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  let attempt = repaired;
  if (inString) {
    attempt += '"';
  }

  // Remove trailing comma or incomplete property
  attempt = attempt.trim().replace(/,\s*$/, '');
  attempt = attempt.replace(/:\s*$/, ': null');
  attempt = attempt.replace(/,\s*$/, '');

  // Append closing brackets
  const closing = [...stack].reverse().join('');
  attempt += closing;

  try {
    return JSON.parse(attempt);
  } catch (err: any) {
    console.log('Attempt 1 failed:', err.message);
    // If closing failed because the last property key was dangling, try trimming back to the last complete scene
    // e.g. find last valid scene boundary '},\s*\{' or '}'
    const lastSceneEnd = attempt.lastIndexOf('},');
    if (lastSceneEnd !== -1) {
      const truncatedToScene = attempt.slice(0, lastSceneEnd + 1) + '\n]\n}';
      try {
        return JSON.parse(truncatedToScene);
      } catch (err2: any) {
        console.log('Attempt 2 failed:', err2.message);
      }
    }
  }

  return null;
}

const parsed = repairTruncatedJson(jsonCandidate);
console.log('Parsed scenes count:', parsed?.scenes?.length);
if (parsed?.scenes) {
  console.log('Last scene:', parsed.scenes[parsed.scenes.length - 1]);
}
