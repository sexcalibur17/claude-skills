import type { Api, Provider } from '../types.ts';
import { getText, stripHtml } from './util.ts';

/**
 * https://api.apis.guru/v2/list.json → ApisGuruList (~9 MB, ~2.5k APIs).
 * Key = "<provider domain>[:<service>]", e.g. "ably.net:control".
 */
export type ApisGuruList = Record<string, ApisGuruEntry>;

export interface ApisGuruEntry {
  added: string;
  /** Key into `versions`. */
  preferred: string;
  versions: Record<string, ApisGuruVersion>;
}

export interface ApisGuruVersion {
  added: string;
  updated: string;
  swaggerUrl: string;
  swaggerYamlUrl: string;
  openapiVer: string;
  link?: string;
  /** OpenAPI `info` object plus x-apisguru extensions. */
  info: {
    title: string;
    version: string;
    /** May contain HTML/Markdown. */
    description?: string;
    contact?: { name?: string; url?: string; email?: string };
    'x-apisguru-categories'?: string[];
    'x-logo'?: { url: string };
    'x-origin'?: Array<{ format: string; url: string; version: string }>;
  };
}

const URL = 'https://api.apis.guru/v2/list.json';

export function toApi(id: string, e: ApisGuruEntry): Api {
  const { info } = e.versions[e.preferred] ?? Object.values(e.versions)[0];
  return {
    name: info.title ?? id,
    description: stripHtml(info.description ?? '').slice(0, 300),
    // provider domain; api-atlas mirrors apis.guru with the same host in `baseUrl` → dedupes
    url: `https://${id.split(':')[0]}`,
    auth: 'unknown',
    https: true,
    categories: info['x-apisguru-categories'] ?? [],
    sources: ['apis-guru'],
  };
}

export const apisGuru: Provider = {
  name: 'apis-guru',
  fetch: () => getText(URL),
  parse: (body) => Object.entries(JSON.parse(body) as ApisGuruList).map(([id, e]) => toApi(id, e)),
};
