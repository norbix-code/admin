/**
 * Minimal JSON → YAML dump for ```norbix-view type=yaml``` blocks (no
 * dependency). Handles objects, arrays and scalars. Pure, so it is
 * unit-testable on its own.
 */

type Json = unknown;

const isObject = (v: Json): v is Record<string, Json> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const yamlScalar = (v: Json): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  const needsQuote =
    s === '' ||
    /^[\s]|[\s]$/.test(s) ||
    /[:#[\]{}&*!|>'"%@`,]/.test(s) ||
    /^(true|false|null|~)$/i.test(s) ||
    /^-?\d/.test(s);
  return needsQuote ? JSON.stringify(s) : s;
};

export const toYaml = (value: Json, indent = 0): string => {
  const pad = '  '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          const childPad = '  '.repeat(indent + 1);
          const lines = toYaml(item, indent + 1).split('\n');
          lines[0] = `${pad}- ${lines[0].slice(childPad.length)}`;
          return lines.join('\n');
        }
        return `${pad}- ${yamlScalar(item)}`;
      })
      .join('\n');
  }

  if (isObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${pad}{}`;
    return entries
      .map(([k, v]) => {
        const nonEmptyObject =
          v !== null &&
          typeof v === 'object' &&
          (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0);
        if (nonEmptyObject) return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
        if (v !== null && typeof v === 'object') {
          return `${pad}${k}: ${Array.isArray(v) ? '[]' : '{}'}`;
        }
        return `${pad}${k}: ${yamlScalar(v)}`;
      })
      .join('\n');
  }

  return `${pad}${yamlScalar(value)}`;
};
