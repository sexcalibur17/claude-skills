import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR = join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'api-finder');
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the cached body if younger than 24h, else calls `fetch` and stores the result.
 * On fetch failure falls back to a stale copy; throws only when there is nothing at all.
 */
export async function cached(key: string, fetch: () => Promise<string>, refresh = false): Promise<string> {
  const file = join(DIR, `${key}.cache`);
  const fresh = await stat(file).then((s) => Date.now() - s.mtimeMs < TTL_MS, () => false);
  if (fresh && !refresh) return readFile(file, 'utf8');
  try {
    const body = await fetch();
    await mkdir(DIR, { recursive: true });
    await writeFile(file, body);
    return body;
  } catch (e) {
    const stale = await readFile(file, 'utf8').catch(() => undefined);
    if (stale === undefined) throw e;
    console.error(`[api-finder] ${key}: fetch failed (${(e as Error).message}), using stale cache`);
    return stale;
  }
}
