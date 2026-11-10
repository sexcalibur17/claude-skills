import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe, parseApisGuru, parseFreePublicApis, parsePublicApis, rank } from './cli.ts';

const md = `### Animals
API | Description | Auth | HTTPS | CORS
|:---|:---|:---|:---|:---|
| [Cat Facts](https://catfact.ninja/) | Random cat facts | No | Yes | Yes |
| [Cats](https://docs.thecatapi.com/) | Pictures of cats | \`apiKey\` | Yes | No |
### Weather
| [Open-Meteo](https://open-meteo.com/) | Global weather forecast | No | Yes | Yes |
`;

const fpa = JSON.stringify([
  { title: 'Cat Facts API', description: 'Get random facts about cats, with images and more', documentation: 'https://catfact.ninja/docs', health: 90 },
]);

const guru = JSON.stringify({
  'weather.example.com': { preferred: '1', versions: { '1': { info: { title: 'Weather Co', description: '<p>Weather data</p>', 'x-apisguru-categories': ['weather'] } } } },
});

test('parse + dedupe + rank end to end', () => {
  const pa = parsePublicApis(md);
  assert.equal(pa.length, 3);
  assert.deepEqual([pa[1].auth, pa[1].cors, pa[2].categories[0]], ['apiKey', false, 'Weather']);

  const g = parseApisGuru(guru);
  assert.equal(g[0].description, 'Weather data');

  const merged = dedupe([...pa, ...parseFreePublicApis(fpa), ...g]);
  assert.equal(merged.length, 4); // Cat Facts merged across sources
  const cat = merged.find((a) => a.name === 'Cat Facts')!;
  assert.deepEqual(cat.sources, ['public-apis', 'free-public-apis']);
  assert.equal(cat.auth, 'none'); // known value kept over unknown
  assert.equal(cat.health, 90);

  const r = rank(merged, 'cat');
  assert.equal(r[0].name, 'Cat Facts'); // multi-source + no-auth beats Cats
  assert.equal(r.length, 2);
  assert.equal(rank(merged, 'weather').length, 2);
  assert.equal(rank(merged, 'zzz').length, 0);
});
