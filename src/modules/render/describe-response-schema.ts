import type { JSONSchema } from 'zod/v4/core';

// Compact prompt guidance for JSON-object mode. The full Zod validator still checks every reply.
export function describeResponseSchema(schema: JSONSchema.JSONSchema): string {
  const alias = (name: string) => name.replace(/^__schema/, 'S');
  const describe = (shape: JSONSchema.JSONSchema | boolean): string => {
    if (typeof shape === 'boolean') return shape ? 'unknown' : 'never';
    if (shape.$ref) return alias(shape.$ref.split('/').at(-1)!);
    if (Object.hasOwn(shape, 'const')) return JSON.stringify(shape.const);
    if (shape.enum) return shape.enum.map(value => JSON.stringify(value)).join('|');
    const variants = shape.anyOf ?? shape.oneOf;
    if (variants) return variants.map(describe).join('|');
    if (shape.type === 'array') {
      if (shape.prefixItems) return `[${shape.prefixItems.map(describe).join(',')}]`;
      if (shape.items === false) return '[]';
      if (Array.isArray(shape.items)) return `[${shape.items.map(describe).join(',')}]`;
      const item = typeof shape.items === 'object' ? describe(shape.items) : 'unknown';
      return `Array<${item}>`;
    }
    if (shape.type === 'object') {
      const required = new Set(shape.required);
      return '{' + Object.entries(shape.properties ?? {}).map(([key, value]) =>
        `${key}${required.has(key) ? '' : '?'}:${describe(value)}`).join(',') + '}';
    }
    return Array.isArray(shape.type) ? shape.type.join('|') : shape.type ?? 'unknown';
  };
  return [`Reply=${describe(schema)}`, ...Object.entries(schema.$defs ?? {}).map(([name, shape]) =>
    `${alias(name)}=${describe(shape)}`)].join('\n');
}
