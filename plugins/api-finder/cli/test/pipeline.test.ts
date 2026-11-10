import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe } from '../src/dedupe.ts';
import { rank } from '../src/rank.ts';
import type { Api } from '../src/types.ts';

const api = (p: Partial<Api> & Pick<Api, 'name' | 'url' | 'sources'>): Api => ({
  description: '', auth: 'unknown', categories: [], ...p,
});

const input: Api[] = [
  api({ name: 'Cat Facts', url: 'https://catfact.ninja/', auth: 'none', cors: true, description: 'Random cat facts', categories: ['Animals'], sources: ['public-apis'] }),
  api({ name: 'Cat Facts API', url: 'https://catfact.ninja/docs', description: 'Get random facts about cats, longer', health: 90, sources: ['free-public-apis'] }),
  api({ name: 'Cats', url: 'https://docs.thecatapi.com/', auth: 'apiKey', description: 'Pictures of cats', sources: ['public-apis'] }),
  api({ name: 'Weather Co', url: 'https://weather.example.com', categories: ['weather'], sources: ['apis-guru'] }),
  api({ name: 'Weather Co', url: 'http://weather.example.com', categories: ['Weather'], cors: false, sources: ['api-atlas'] }),
];

test('dedupe: merges by name+domain, keeps known values', () => {
  const out = dedupe(input);
  assert.equal(out.length, 3);
  const cat = out.find((a) => a.name === 'Cat Facts')!;
  assert.deepEqual(cat.sources, ['public-apis', 'free-public-apis']);
  assert.deepEqual([cat.auth, cat.cors, cat.health], ['none', true, 90]);
  assert.equal(cat.description, 'Get random facts about cats, longer');
  const w = out.find((a) => a.name === 'Weather Co')!;
  assert.deepEqual([w.sources, w.categories, w.cors], [['apis-guru', 'api-atlas'], ['weather', 'Weather'], false]);
  assert.equal(input[0].sources.length, 1, 'input not mutated');
});

test('rank: relevance + bonuses, drops non-matches', () => {
  const merged = dedupe(input);
  const r = rank(merged, 'cat');
  assert.deepEqual(r.map((a) => a.name), ['Cat Facts', 'Cats']); // multi-source + no-auth wins
  assert.equal(rank(merged, 'weather').length, 1);
  assert.equal(rank(merged, 'zzz').length, 0);
});
