#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { cached } from './cache.ts';
import { dedupe } from './dedupe.ts';
import { PROVIDERS, isProviderName } from './providers/index.ts';
import { rank } from './rank.ts';
import type { Api, Provider } from './types.ts';

const HELP = `Usage: api-finder <query...> [options]

Options:
  --no-auth          only APIs known to need no auth
  --https            only HTTPS APIs
  --cors             only APIs with CORS enabled (browser-callable)
  --source <name>    restrict to provider (repeatable): ${Object.keys(PROVIDERS).join(', ')}
  --limit <n>        max results (default 20)
  --refresh          ignore 24h cache
  -h, --help

Output: JSON array of ranked APIs to stdout (schema: cli/src/types.ts).`;

/** One provider failing must not kill the search → log and return []. */
async function load(p: Provider, refresh: boolean): Promise<Api[]> {
  try {
    return p.parse(await cached(p.name, p.fetch, refresh));
  } catch (e) {
    console.error(`[api-finder] ${p.name}: skipped (${(e as Error).message})`);
    return [];
  }
}

async function main(): Promise<void> {
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

  const names = values.source ?? Object.keys(PROVIDERS);
  const bad = names.filter((n) => !isProviderName(n));
  if (bad.length) throw new Error(`unknown source: ${bad.join(', ')}`);
  const providers = names.filter(isProviderName).map((n) => PROVIDERS[n]);

  const all = (await Promise.all(providers.map((p) => load(p, !!values.refresh)))).flat();
  const results = rank(dedupe(all), query).filter(
    (a) => (!values['no-auth'] || a.auth === 'none') && (!values.https || a.https) && (!values.cors || a.cors),
  );
  console.log(JSON.stringify(results.slice(0, Number(values.limit) || 20), null, 2));
}

main().catch((e: Error) => {
  console.error(`[api-finder] ${e.message}`);
  process.exit(1);
});
