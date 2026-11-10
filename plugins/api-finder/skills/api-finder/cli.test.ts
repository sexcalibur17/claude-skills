import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe, parseApiAtlas, parseApisGuru, parseFreePublicApis, parsePublicApis, rank } from './cli.ts';

const md = `### Animals
API | Description | Auth | HTTPS | CORS
|:---|:---|:---|:---|:---|
| [Cat Facts](https://catfact.ninja/) | Random cat facts | No | Yes | Yes |
| [Cats](https://docs.thecatapi.com/) | Pictures of cats | \`apiKey\` | Yes | No |
### Weather
| [Promo](https://promo.example/) | Sponsored row | [<img src="x">](https://postman.example)|
| [Open-Meteo](https://open-meteo.com/) | Global weather forecast | No | Yes | Yes |
`;

const fpa = JSON.stringify([
  { title: 'Cat Facts API', description: 'Get random facts about cats, with images and more', documentation: 'https://catfact.ninja/docs', health: 90 },
]);

const guru = JSON.stringify({
  'weather.example.com': { preferred: '1', versions: { '1': { info: { title: 'Weather Co', description: '<p>Weather data</p>', 'x-apisguru-categories': ['weather'] } } } },
});

const atlas = JSON.stringify([
  { slug: 'open-meteo', name: 'Open-Meteo', description: '<b>Weather</b> forecast', category: 'Weather', tags: ['Weather'], auth: 'None', cors: 'Yes', docsUrl: 'https://open-meteo.com/en/docs' },
  { slug: 'weather-co', name: 'Weather Co', description: 'x', category: 'Weather', auth: 'unknown', cors: null, docsUrl: 'https://api.apis.guru/v2/specs/weather.example.com/1/openapi.json', baseUrl: 'http://weather.example.com' },
  { slug: 'gh', name: 'GitHub', category: 'Development', auth: 'OAuth', docsUrl: null, baseUrl: null },
]);

test('parse + dedupe + rank end to end', () => {
  const pa = parsePublicApis(md);
  assert.equal(pa.length, 3);
  assert.deepEqual([pa[1].auth, pa[1].cors, pa[2].categories[0]], ['apiKey', false, 'Weather']);

  const g = parseApisGuru(guru);
  assert.equal(g[0].description, 'Weather data');

  const at = parseApiAtlas(atlas);
  assert.deepEqual([at[0].auth, at[0].cors, at[0].description, at[0].categories], ['none', true, 'Weather forecast', ['Weather']]);
  assert.equal(at[1].url, 'http://weather.example.com'); // apis.guru spec url replaced by baseUrl
  assert.deepEqual([at[2].auth, at[2].url], ['oauth', 'https://www.atlasapi.space/apis/gh/']);

  const merged = dedupe([...pa, ...parseFreePublicApis(fpa), ...g, ...at]);
  assert.equal(merged.length, 5); // Cat Facts, Open-Meteo, Weather Co merged across sources
  assert.deepEqual(merged.find((a) => a.name === 'Open-Meteo')!.sources, ['public-apis', 'api-atlas']);
  assert.deepEqual(merged.find((a) => a.name === 'Weather Co')!.sources, ['apis-guru', 'api-atlas']);
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
