#!/usr/bin/env node
// api-finder: aggregate public API catalogs → normalize → dedupe → rank → JSON.
import { parseArgs } from 'node:util';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Auth = 'none' | 'apiKey' | 'oauth' | 'other' | 'unknown';
export type Api = {
  name: string;
  description: string;
  url: string;
  auth: Auth;
  https?: boolean;
  cors?: boolean;
  categories: string[];
  sources: string[];
  health?: number; // 0..100, freepublicapis only
};

const CACHE_DIR = join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'api-finder');
const TTL_MS = 24 * 60 * 60 * 1000;

const PROVIDERS = {
  'public-apis': {
    url: 'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md',
    parse: parsePublicApis,
  },
  'free-public-apis': {
    url: 'https://www.freepublicapis.com/api/apis?limit=10000',
    parse: parseFreePublicApis,
  },
  'apis-guru': {
    url: 'https://api.apis.guru/v2/list.json',
    parse: parseApisGuru,
  },
} satisfies Record<string, { url: string; parse: (raw: string) => Api[] }>;
type ProviderName = keyof typeof PROVIDERS;

// ---------- providers ----------

export function parsePublicApis(md: string): Api[] {
  const out: Api[] = [];
  let category = '';
  for (const line of md.split('\n')) {
    const h = line.match(/^### (.+)/);
    if (h) { category = h[1].trim(); continue; }
    const m = line.match(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|(.*)\|\s*$/);
    if (!m || !category) continue;
    const [desc = '', auth = '', https = '', cors = ''] = m[3].split('|').map((c) => c.trim());
    out.push({
      name: m[1].trim(),
      description: desc,
      url: m[2].trim(),
      auth: normAuth(auth),
      https: https.toLowerCase() === 'yes',
      cors: cors.toLowerCase() === 'yes' ? true : cors.toLowerCase() === 'no' ? false : undefined,
      categories: [category],
      sources: ['public-apis'],
    });
  }
  return out;
}

export function parseFreePublicApis(json: string): Api[] {
  const rows: Array<{ title: string; description?: string; documentation?: string; source?: string; health?: number }> =
    JSON.parse(json);
  return rows.map((r) => ({
    name: r.title,
    description: r.description ?? '',
    url: r.documentation || r.source || '',
    auth: 'unknown', // catalog only lists free APIs, but doesn't say keyless
    https: (r.documentation ?? '').startsWith('https://') || undefined,
    categories: [],
    sources: ['free-public-apis'],
    health: r.health,
  }));
}

export function parseApisGuru(json: string): Api[] {
  const list: Record<string, { preferred: string; versions: Record<string, any> }> = JSON.parse(json);
  return Object.entries(list).map(([id, e]) => {
    const info = (e.versions[e.preferred] ?? Object.values(e.versions)[0]).info ?? {};
    const domain = id.split(':')[0];
    return {
      name: info.title ?? id,
      description: stripHtml(info.description ?? '').slice(0, 300),
      url: info.contact?.url || `https://${domain}`,
      auth: 'unknown',
      https: true,
      categories: info['x-apisguru-categories'] ?? [],
      sources: ['apis-guru'],
    };
  });
}

// ---------- normalize / dedupe / rank ----------

function normAuth(s: string): Auth {
  const v = s.replace(/`/g, '').trim().toLowerCase();
  if (v === 'no' || v === '') return 'none';
  if (v === 'apikey') return 'apiKey';
  if (v === 'oauth') return 'oauth';
  return 'other';
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const normName = (s: string) => s.toLowerCase().replace(/\bapi\b/g, '').replace(/[^a-z0-9]/g, '');

// ponytail: naive "last two labels" domain, wrong for co.uk-style TLDs; use a PSL lib if dupes slip through.
function baseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.').slice(-2).join('.');
  } catch {
    return '';
  }
}

export function dedupe(apis: Api[]): Api[] {
  const byKey = new Map<string, Api>();
  for (const a of apis) {
    const key = `${normName(a.name)}|${baseDomain(a.url)}`;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, { ...a, categories: [...a.categories], sources: [...a.sources] }); continue; }
    // public-apis has the richest auth/https/cors data — prefer known values over unknown.
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

export function rank(apis: Api[], query: string): Array<Api & { score: number }> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = apis.map((a) => {
    const name = a.name.toLowerCase();
    const cats = a.categories.join(' ').toLowerCase();
    const desc = a.description.toLowerCase();
    let hits = 0;
    let score = 0;
    for (const t of terms) {
      const s = (name.includes(t) ? 3 : 0) + (cats.includes(t) ? 2 : 0) + (desc.includes(t) ? 1 : 0);
      if (s) hits++;
      score += s;
    }
    if (terms.length && hits === 0) return { ...a, score: 0 };
    score += hits === terms.length ? 2 : 0; // all terms matched
    score += a.sources.length - 1; // listed in several catalogs ≈ more established
    if (a.auth === 'none') score += 1;
    if (a.health !== undefined) score += a.health / 100;
    return { ...a, score: Math.round(score * 100) / 100 };
  });
  return scored.filter((a) => a.score > 0).sort((x, y) => y.score - x.score);
}

// ---------- fetch with file cache ----------

async function load(name: ProviderName, refresh: boolean): Promise<Api[]> {
  const file = join(CACHE_DIR, `${name}.cache`);
  const fresh = await stat(file).then((s) => Date.now() - s.mtimeMs < TTL_MS, () => false);
  let raw: string | undefined;
  if (fresh && !refresh) raw = await readFile(file, 'utf8');
  else {
    try {
      const res = await fetch(PROVIDERS[name].url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.text();
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, raw);
    } catch (e) {
      raw = await readFile(file, 'utf8').catch(() => undefined); // stale cache beats nothing
      console.error(`[api-finder] ${name}: fetch failed (${(e as Error).message})${raw ? ', using stale cache' : ', skipped'}`);
    }
  }
  if (!raw) return [];
  try {
    return PROVIDERS[name].parse(raw);
  } catch (e) {
    console.error(`[api-finder] ${name}: parse failed (${(e as Error).message}), skipped`);
    return [];
  }
}

// ---------- CLI ----------

const HELP = `Usage: api-finder <query...> [options]

Options:
  --no-auth          only APIs that need no auth (known from public-apis)
  --https            only HTTPS APIs
  --cors             only APIs with CORS enabled (browser-callable)
  --source <name>    restrict to provider (repeatable): ${Object.keys(PROVIDERS).join(', ')}
  --limit <n>        max results (default 20)
  --refresh          ignore 24h cache
  -h, --help

Output: JSON array to stdout, sorted by score.`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'no-auth': { type: 'boolean' },
      https: { type: 'boolean' },
      cors: { type: 'boolean' },
      source: { type: 'string', multiple: true },
      limit: { type: 'string', default: '20' },
      refresh: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const query = positionals.join(' ').trim();
  if (values.help || !query) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }
  const names = (values.source ?? Object.keys(PROVIDERS)) as ProviderName[];
  for (const n of names) if (!(n in PROVIDERS)) throw new Error(`unknown source: ${n}`);

  const all = (await Promise.all(names.map((n) => load(n, !!values.refresh)))).flat();
  let results = rank(dedupe(all), query);
  if (values['no-auth']) results = results.filter((a) => a.auth === 'none');
  if (values.https) results = results.filter((a) => a.https);
  if (values.cors) results = results.filter((a) => a.cors);
  console.log(JSON.stringify(results.slice(0, Number(values.limit) || 20), null, 2));
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`[api-finder] ${e.message}`);
    process.exit(1);
  });
}
