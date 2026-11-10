import type { Api, RankedApi } from './types.ts';

const W = {
  name: 3,
  category: 2,
  description: 1,
  allTermsMatched: 2,
  perExtraSource: 1, // listed in several catalogs ≈ more established
  noAuth: 1,
  health: 1, // scaled by health/100
};

/** Keyword relevance + quality bonuses. Drops records matching no term. Sorted best first. */
export function rank(apis: Api[], query: string): RankedApi[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: RankedApi[] = [];
  for (const a of apis) {
    const name = a.name.toLowerCase();
    const cats = a.categories.join(' ').toLowerCase();
    const desc = a.description.toLowerCase();
    let hits = 0;
    let score = 0;
    for (const t of terms) {
      const s =
        (name.includes(t) ? W.name : 0) + (cats.includes(t) ? W.category : 0) + (desc.includes(t) ? W.description : 0);
      if (s) hits++;
      score += s;
    }
    if (hits === 0) continue;
    if (hits === terms.length) score += W.allTermsMatched;
    score += (a.sources.length - 1) * W.perExtraSource;
    if (a.auth === 'none') score += W.noAuth;
    if (a.health !== undefined) score += (a.health / 100) * W.health;
    out.push({ ...a, score: Math.round(score * 100) / 100 });
  }
  return out.sort((x, y) => y.score - x.score);
}
