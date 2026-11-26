import { SaxesParser } from 'saxes';

const svgNamespace = 'http://www.w3.org/2000/svg';
const elements = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'mask']);
const numeric = new Set(['x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'fx', 'fy', 'r', 'rx', 'ry',
  'width', 'height', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'offset', 'stop-opacity']);
const enums: Record<string, readonly string[]> = {
  'stroke-linecap': ['round', 'square', 'butt'], 'stroke-linejoin': ['round', 'bevel', 'miter'],
  'fill-rule': ['nonzero', 'evenodd'], 'clip-rule': ['nonzero', 'evenodd'],
  gradientUnits: ['objectBoundingBox', 'userSpaceOnUse'], patternUnits: ['objectBoundingBox', 'userSpaceOnUse'],
  clipPathUnits: ['objectBoundingBox', 'userSpaceOnUse'], maskUnits: ['objectBoundingBox', 'userSpaceOnUse'],
};
const key = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;
const number = /^(?:-?(?:\d+\.?\d*|\.\d+))(?:[eE][+-]?\d+)?%?$/;
const numberList = /^[0-9.,\s+eE-]+$/;
const paint = /^(?:#[0-9a-f]{3,8}|none|currentColor|transparent|black|white|[a-z]{3,16})$/i;
const fragment = /^url\(#([a-zA-Z][a-zA-Z0-9_.-]{0,63})\)$/;
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const boundedGeometry = (value: string) => {
  const operands = value.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  return operands.length >= 1 && operands.length <= 1800 && operands.every(part => Math.abs(Number(part)) <= 100000);
};

export function sanitizeVectorAsset(bytes: Buffer) {
  if (bytes.length > 256 * 1024) throw new Error('SVG asset exceeds 256 KB.');
  const parser = new SaxesParser();
  const out: string[] = [];
  const ids = new Set<string>();
  const references: string[] = [];
  let depth = 0;
  let count = 0;
  let width = 0;
  let height = 0;
  const fail = () => { throw new Error('SVG asset uses unsupported or unsafe markup. Supply standalone vector geometry.'); };
  parser.on('error', fail);
  parser.on('doctype', fail);
  parser.on('processinginstruction', fail);
  parser.on('cdata', fail);
  parser.on('text', value => { if (value.trim()) fail(); });
  parser.on('opentag', tag => {
    if (!elements.has(tag.name) || ++count > 400 || ++depth > 12 || (tag.name === 'svg') !== (depth === 1)) fail();
    const attrs: string[] = [];
    if (tag.name === 'svg') {
      const raw = tag.attributes.viewBox;
      if (!raw || !numberList.test(raw)) return fail();
      const viewBox = raw.trim().split(/[\s,]+/).map(Number);
      if (viewBox.length !== 4 || viewBox.some(n => !Number.isFinite(n) || Math.abs(n) > 100000)) return fail();
      [, , width, height] = viewBox;
      if (width <= 0 || height <= 0 || width > 6000 || height > 6000) return fail();
      attrs.push(`xmlns="${svgNamespace}" viewBox="${viewBox.join(' ')}"`);
    }
    for (const [attr, value] of Object.entries(tag.attributes)) {
      if (value.length > 10000) fail();
      if (tag.name === 'svg' && ['viewBox', 'width', 'height'].includes(attr)) continue;
      if (attr === 'xmlns' && tag.name === 'svg' && value === svgNamespace) continue;
      if (attr === 'id') {
        if (!key.test(value) || ids.has(value)) fail();
        ids.add(value);
      } else if (['fill', 'stroke', 'stop-color', 'mask', 'clip-path'].includes(attr)) {
        const match = fragment.exec(value);
        if (match) references.push(match[1]);
        else if (attr === 'mask' || attr === 'clip-path' || !paint.test(value)) fail();
      } else if (numeric.has(attr)) {
        if (!number.test(value) || Math.abs(Number(value.replace('%', ''))) > 100000) fail();
      } else if (attr === 'd') {
        if (!/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+eE-]+$/.test(value) || !boundedGeometry(value)) fail();
      } else if (['points', 'stroke-dasharray'].includes(attr)) {
        if (!numberList.test(value) || !boundedGeometry(value)) fail();
      } else if (['transform', 'gradientTransform', 'patternTransform'].includes(attr)) {
        if (!/^(?:(?:matrix|translate|rotate|scale|skewX|skewY)\([0-9eE+.,\s-]+\)\s*)+$/.test(value)
          || !boundedGeometry(value)) fail();
      } else if (!Object.hasOwn(enums, attr) || !enums[attr].includes(value)) fail();
      attrs.push(`${attr}="${escape(value)}"`);
    }
    out.push(`<${tag.name}${attrs.length ? ' ' + attrs.join(' ') : ''}>`);
  });
  parser.on('closetag', tag => { out.push(`</${tag.name}>`); depth--; });
  parser.write(bytes.toString('utf8')).close();
  if (!width || !height || references.some(ref => !ids.has(ref))) fail();
  return { bytes: Buffer.from(out.join('')), width, height };
}
