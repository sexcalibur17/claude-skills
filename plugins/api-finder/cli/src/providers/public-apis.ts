import type { Api, Provider } from '../types.ts';
import { getText, normAuth, yesNo } from './util.ts';

/**
 * https://github.com/public-apis/public-apis — no JSON, only a Markdown README:
 *
 *   ### Animals
 *   API | Description | Auth | HTTPS | CORS
 *   |:---|:---|:---|:---|:---|
 *   | [Cat Facts](https://catfact.ninja/) | Random cat facts | No | Yes | Yes |
 */
export interface PublicApisRow {
  name: string;
  url: string;
  description: string;
  /** "No" | "`apiKey`" | "`OAuth`" | "`X-Mashape-Key`" | "`User-Agent`" */
  auth: string;
  /** "Yes" | "No" */
  https: string;
  /** "Yes" | "No" | "Unknown" */
  cors: string;
  /** Nearest `### ` heading. */
  category: string;
}

const URL = 'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md';
const ROW = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|(.*)\|\s*$/;

export function parseRows(md: string): PublicApisRow[] {
  const rows: PublicApisRow[] = [];
  let category = '';
  for (const line of md.split('\n')) {
    const h = line.match(/^### (.+)/);
    if (h) { category = h[1].trim(); continue; }
    const m = line.match(ROW);
    if (!m || !category) continue;
    const cells = m[3].split('|').map((c) => c.trim());
    if (cells.length < 4) continue; // promo tables (e.g. "Best sellers" w/ Postman buttons) lack auth/https/cors
    const [description, auth, https, cors] = cells;
    rows.push({ name: m[1].trim(), url: m[2].trim(), description, auth, https, cors, category });
  }
  return rows;
}

export function toApi(r: PublicApisRow): Api {
  return {
    name: r.name,
    description: r.description,
    url: r.url,
    auth: normAuth(r.auth),
    https: yesNo(r.https),
    cors: yesNo(r.cors),
    categories: [r.category],
    sources: ['public-apis'],
  };
}

export const publicApis: Provider = {
  name: 'public-apis',
  fetch: () => getText(URL),
  parse: (body) => parseRows(body).map(toApi),
};
