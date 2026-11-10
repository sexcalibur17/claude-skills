/** How a client authenticates. `unknown` = the catalog doesn't say. */
export type Auth = 'none' | 'apiKey' | 'oauth' | 'other' | 'unknown';

/**
 * Unified record. Every provider normalizes its raw entries into this shape;
 * the CLI prints an array of these (plus `score`).
 * Optional fields are `undefined` (omitted from JSON) when no source knows the value.
 */
export interface Api {
  name: string;
  description: string;
  /** Docs or homepage. */
  url: string;
  auth: Auth;
  https?: boolean;
  /** CORS enabled → callable straight from browser JS. */
  cors?: boolean;
  categories: string[];
  /** Providers that list this API, after dedupe. */
  sources: ProviderName[];
  /** 0..100 uptime health, freepublicapis.com only. */
  health?: number;
}

export interface RankedApi extends Api {
  score: number;
}

export type ProviderName = 'public-apis' | 'free-public-apis' | 'apis-guru' | 'api-atlas';

export interface Provider {
  name: ProviderName;
  /** Download the raw catalog. The body is cached verbatim, so it must be a string. */
  fetch(): Promise<string>;
  /** Raw body → unified records. Raw schema lives next to each provider. */
  parse(body: string): Api[];
}
