// config/secret-interpolate.ts
import { SecretSource } from './secret-source.ts';

const TOKEN = /\$\{(?<source>env|secret):(?<key>[A-Za-z0-9_\-./]+)\}/g;

type Missing = { source: string; key: string; placeholder: string };

export async function interpolate(
  obj: unknown,
  sources: Record<string, SecretSource>,
): Promise<{ value: unknown; missing: Missing[] }> {
  const missing: Missing[] = [];
  const json = JSON.stringify(obj);

  const replaced = await jsonReplaceAsync(json, TOKEN, async (match, groups) => {
    const src = sources[groups.source];
    if (!src) throw new Error(`Unknown secret source '${groups.source}' in ${match}`);
    const val = await src.get(groups.key);
    if (val == null || val === '') {
      missing.push({ source: groups.source, key: groups.key, placeholder: match });
      // Keep JSON valid. For strings we can safely replace with an empty string literal.
      return '';
    }
    return val;
  });

  return { value: JSON.parse(replaced), missing };
}

// Convenience wrapper: throw if anything is missing
export async function interpolateStrict(
  obj: unknown,
  sources: Record<string, SecretSource>,
): Promise<unknown> {
  const { value, missing } = await interpolate(obj, sources);
  if (missing.length) {
    // Group by source to make it scannable
    const bySource = new Map<string, Set<string>>();
    for (const m of missing) {
      if (!bySource.has(m.source)) bySource.set(m.source, new Set());
      bySource.get(m.source)!.add(m.key);
    }
    const lines: string[] = [];
    for (const [source, keys] of bySource) {
      lines.push(`- ${source}: ${Array.from(keys).sort().join(', ')}`);
    }
    throw new Error(
      [
        'Missing required secrets for config interpolation:',
        ...lines,
        'Define them in your environment or secret provider (e.g., .env.local).',
      ].join('\n'),
    );
  }
  return value;
}

async function jsonReplaceAsync(
  str: string,
  regex: RegExp,
  replacer: (match: string, groups: any) => Promise<string>,
): Promise<string> {
  const out: string[] = [];
  let last = 0;
  for (;;) {
    const m = regex.exec(str);
    if (!m) {
      out.push(str.slice(last));
      break;
    }
    out.push(str.slice(last, m.index));
    out.push(await replacer(m[0], m.groups));
    last = m.index + m[0].length;
  }
  return out.join('');
}
