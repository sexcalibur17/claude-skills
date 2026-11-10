import type { Api, Provider } from '../types.ts';
import { getText, normAuth, stripHtml, yesNo } from './util.ts';

/**
 * https://www.atlasapi.space/how-to/ — GET /api/v1/catalog?type=api&limit=2000[&cursor=…] → ApiAtlasPage.
 * Itself aggregates public-apis + apis.guru (+ MCP registries, excluded via type=api).
 */
export interface ApiAtlasPage {
  entries: ApiAtlasEntry[];
  /** Opaque; null on the last page. */
  nextCursor: string | null;
  /** Always null (they skip COUNT). */
  total: null;
}

export interface ApiAtlasEntry {
  id: string;
  /** Stable; https://www.atlasapi.space/apis/<slug>/ */
  slug: string;
  name: string;
  tagline: string | null;
  /** May contain HTML. */
  description: string | null;
  category: string | null;
  tags: string[] | null;
  type: 'api' | 'mcp';
  /** "None" | "API Key" | "OAuth" | "User-Agent" | "unknown" */
  auth: string | null;
  /** "Yes" | "No" | null */
  cors: string | null;
  /** For apis.guru mirrors this is a raw OpenAPI spec URL on api.apis.guru. */
  docsUrl: string | null;
  baseUrl: string | null;
  githubUrl: string | null;
  /** Same value everywhere, carries no info. */
  pricing: string;
  /** Synthetic sort key, NOT real popularity. */
  popularity: number;
  freeTier: string | null;
}

const BASE = 'https://www.atlasapi.space/api/v1/catalog?type=api&limit=2000';

/** Walks all pages, returns entries as one JSON array (that's what gets cached). */
async function fetchAll(): Promise<string> {
  const entries: ApiAtlasEntry[] = [];
  let cursor: string | null = null;
  do {
    const page: ApiAtlasPage = JSON.parse(await getText(cursor ? `${BASE}&cursor=${encodeURIComponent(cursor)}` : BASE));
    entries.push(...page.entries);
    cursor = page.nextCursor;
  } while (cursor);
  return JSON.stringify(entries);
}

export function toApi(r: ApiAtlasEntry): Api {
  const docs = r.docsUrl && !r.docsUrl.includes('apis.guru') ? r.docsUrl : null;
  const url = docs ?? r.baseUrl ?? `https://www.atlasapi.space/apis/${r.slug}/`;
  return {
    name: r.name,
    description: stripHtml(r.description || r.tagline || '').slice(0, 300),
    url,
    auth: normAuth(r.auth),
    https: url.startsWith('https://') || undefined,
    cors: yesNo(r.cors),
    categories: [...new Set([r.category, ...(r.tags ?? [])].filter((c): c is string => !!c))],
    sources: ['api-atlas'],
  };
}

export const apiAtlas: Provider = {
  name: 'api-atlas',
  fetch: fetchAll,
  parse: (body) => (JSON.parse(body) as ApiAtlasEntry[]).map(toApi),
};
