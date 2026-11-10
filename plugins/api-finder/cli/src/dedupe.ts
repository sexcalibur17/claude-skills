import type { Api } from './types.ts';

const normName = (s: string) => s.toLowerCase().replace(/\bapi\b/g, '').replace(/[^a-z0-9]/g, '');

// ponytail: naive "last two labels" domain, wrong for co.uk-style TLDs; use a PSL lib if dupes slip through.
function baseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.').slice(-2).join('.');
  } catch {
    return '';
  }
}

/** Same normalized name + same base domain = same API. Merged record keeps the most-known value per field. */
export function dedupe(apis: Api[]): Api[] {
  const byKey = new Map<string, Api>();
  for (const a of apis) {
    const key = `${normName(a.name)}|${baseDomain(a.url)}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...a, categories: [...a.categories], sources: [...a.sources] });
      continue;
    }
    if (prev.auth === 'unknown') prev.auth = a.auth;
    prev.https ??= a.https;
    prev.cors ??= a.cors;
    prev.health ??= a.health;
    if (a.description.length > prev.description.length) prev.description = a.description;
    for (const c of a.categories) if (!prev.categories.includes(c)) prev.categories.push(c);
    for (const s of a.sources) if (!prev.sources.includes(s)) prev.sources.push(s);
  }
  return [...byKey.values()];
}
