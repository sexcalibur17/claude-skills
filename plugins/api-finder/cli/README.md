# api-finder CLI

Aggregates public API catalogs → normalize → dedupe → rank → JSON. Node ≥ 22.18 runs the TS directly; no build, no runtime deps.

```
./src/main.ts weather forecast --no-auth --limit 5
npm test          # node:test
npm run typecheck # tsc, dev only
```

## Layout

```
src/
  main.ts              CLI: args → load providers → dedupe → rank → filter → stdout
  types.ts             Api (output schema), Provider interface
  cache.ts             ~/.cache/api-finder/<provider>.cache, 24h TTL, stale fallback
  dedupe.ts            merge by normalized name + base domain
  rank.ts              keyword relevance + bonuses (weights in W)
  providers/
    index.ts           registry
    util.ts            getText, normAuth, yesNo, stripHtml
    <provider>.ts      raw response types + toApi() mapper + Provider
test/
  providers.test.ts    raw fixture → Api, per provider
  pipeline.test.ts     dedupe + rank
```

## Providers

| Name | Endpoint | Raw schema | auth/cors data |
|---|---|---|---|
| `public-apis` | GitHub README (Markdown tables) | `PublicApisRow` | yes / yes |
| `free-public-apis` | `freepublicapis.com/api/apis` | `FreePublicApisItem` | no / no (has `health`) |
| `apis-guru` | `api.apis.guru/v2/list.json` | `ApisGuruList` | no / no |
| `api-atlas` | `atlasapi.space/api/v1/catalog` (cursor paged) | `ApiAtlasPage`, `ApiAtlasEntry` | partial / partial |

Add one: `src/providers/<name>.ts` exporting a `Provider` → add name to `ProviderName` in `types.ts` → register in `providers/index.ts` → fixture test in `providers.test.ts`.
