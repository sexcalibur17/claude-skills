---
name: api-finder
description: Find free/public third-party APIs for a feature or side project by searching API Atlas, public-apis, freepublicapis.com and APIs.guru. Use when the user needs a data source or external API ("is there an API for X", "find a free weather API", "какое API взять для ...", "найди публичное API").
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/cli/src/main.ts *)
---

Run:

```bash
${CLAUDE_PLUGIN_ROOT}/cli/src/main.ts <keywords> [--no-auth] [--https] [--cors] [--limit N] [--source api-atlas|public-apis|free-public-apis|apis-guru] [--refresh]
```

- Query = short English keywords (`weather forecast`, `recipes`, `currency exchange`). Translate non-English requests. Try synonyms if results are thin.
- Output: JSON array sorted by `score`. Fields: `name, description, url, auth (none|apiKey|oauth|other|unknown), https, cors, categories, sources, health`.
- `auth: "unknown"` = catalog doesn't say. Real auth/CORS data comes mostly from public-apis and API Atlas, so `--no-auth`/`--cors` skip entries that only appear in APIs.guru or freepublicapis.com.
- Browser-only app (no backend)? Prefer `--cors` and `auth: none`.
- More `sources` = listed in several catalogs, usually more established. `health` (0–100) is uptime from freepublicapis.com.

Present the top 3–5 picks: name, url, auth, one line on why it fits. Catalog data can be stale: before writing integration code, open the API's docs to confirm the endpoint and auth still work.
