import type { Provider, ProviderName } from '../types.ts';
import { apiAtlas } from './api-atlas.ts';
import { apisGuru } from './apis-guru.ts';
import { freePublicApis } from './free-public-apis.ts';
import { publicApis } from './public-apis.ts';

/** Add a provider: create providers/<name>.ts exporting a Provider, extend ProviderName, register here. */
export const PROVIDERS: Record<ProviderName, Provider> = {
  'public-apis': publicApis,
  'free-public-apis': freePublicApis,
  'apis-guru': apisGuru,
  'api-atlas': apiAtlas,
};

export const isProviderName = (s: string): s is ProviderName => s in PROVIDERS;
