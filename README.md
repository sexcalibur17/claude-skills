# claude-skills

Personal Claude Code plugin marketplace. Plugins are enabled per project, so nothing leaks into unrelated work sessions.

## Install

```
/plugin install api-finder --marketplace sexcalibur17/claude-skills --scope local   # or --scope project to commit it
```

## Plugins

| Plugin | What |
|---|---|
| `api-finder` | Search public API catalogs (API Atlas, public-apis, freepublicapis.com, APIs.guru) → deduped, ranked JSON. Needs Node ≥ 22.18 (runs TS natively). |

## Dev

```
cd plugins/api-finder/cli && npm i && npm test && npm run typecheck
claude --plugin-dir plugins/api-finder   # try a plugin without installing
```

See `plugins/api-finder/cli/README.md` for CLI layout and provider schemas.
