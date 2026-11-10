import type { Api, Provider } from '../types.ts';
import { getText } from './util.ts';

/** https://www.freepublicapis.com/api/apis → FreePublicApisItem[] (default page 100, `limit` raises it). */
export interface FreePublicApisItem {
  id: number;
  emoji: string;
  title: string;
  description: string;
  /** Docs URL, sometimes an OpenAPI file. */
  documentation: string;
  methods: number;
  /** 0..100, from their uptime checks. */
  health: number;
  popularity: number;
  avg_reliability: number;
  avg_error: number;
  /** ms */
  avg_latency: number;
  /** freepublicapis.com detail page. */
  source: string;
}

const URL = 'https://www.freepublicapis.com/api/apis?limit=10000';

export function toApi(r: FreePublicApisItem): Api {
  return {
    name: r.title,
    description: r.description ?? '',
    url: r.documentation || r.source,
    auth: 'unknown', // catalog only lists free APIs, but doesn't say keyless
    https: r.documentation?.startsWith('https://') || undefined,
    categories: [],
    sources: ['free-public-apis'],
    health: r.health,
  };
}

export const freePublicApis: Provider = {
  name: 'free-public-apis',
  fetch: () => getText(URL),
  parse: (body) => (JSON.parse(body) as FreePublicApisItem[]).map(toApi),
};
