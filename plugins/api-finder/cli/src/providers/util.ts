import type { Auth } from '../types.ts';

export async function getText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/** Free-form auth label ("No", "`apiKey`", "API Key", "OAuth", "None"…) → Auth. */
export function normAuth(label: string | null | undefined): Auth {
  const v = (label ?? '').replace(/[`\s]/g, '').toLowerCase();
  if (v === '' || v === 'unknown') return 'unknown';
  if (v === 'no' || v === 'none') return 'none';
  if (v === 'apikey') return 'apiKey';
  if (v === 'oauth') return 'oauth';
  return 'other';
}

/** "Yes" / "No" / anything else → boolean | undefined. */
export function yesNo(v: string | null | undefined): boolean | undefined {
  const s = v?.trim().toLowerCase();
  return s === 'yes' ? true : s === 'no' ? false : undefined;
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
