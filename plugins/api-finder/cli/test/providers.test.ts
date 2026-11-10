import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiAtlas } from '../src/providers/api-atlas.ts';
import { apisGuru } from '../src/providers/apis-guru.ts';
import { freePublicApis } from '../src/providers/free-public-apis.ts';
import { publicApis } from '../src/providers/public-apis.ts';

test('public-apis: parses category tables, skips promo rows', () => {
  const md = `### Animals
API | Description | Auth | HTTPS | CORS
|:---|:---|:---|:---|:---|
| [Cat Facts](https://catfact.ninja/) | Random cat facts | No | Yes | Yes |
| [Cats](https://docs.thecatapi.com/) | Pictures of cats | \`apiKey\` | Yes | Unknown |
| [Promo](https://promo.example/) | Sponsored row | [<img src="x">](https://postman.example)|
`;
  const [cat, cats, ...rest] = publicApis.parse(md);
  assert.equal(rest.length, 0);
  assert.deepEqual(cat, {
    name: 'Cat Facts', description: 'Random cat facts', url: 'https://catfact.ninja/',
    auth: 'none', https: true, cors: true, categories: ['Animals'], sources: ['public-apis'],
  });
  assert.deepEqual([cats.auth, cats.cors], ['apiKey', undefined]);
});

test('free-public-apis: maps title/documentation/health, auth unknown', () => {
  const [a] = freePublicApis.parse(JSON.stringify([
    { id: 1, title: 'Cat Facts API', description: 'facts', documentation: 'https://catfact.ninja/docs', health: 90, source: 'https://freepublicapis.com/cat' },
  ]));
  assert.deepEqual([a.name, a.url, a.auth, a.https, a.health], ['Cat Facts API', 'https://catfact.ninja/docs', 'unknown', true, 90]);
});

test('apis-guru: preferred version, provider domain as url, html stripped', () => {
  const [a] = apisGuru.parse(JSON.stringify({
    'weather.example.com:v2': {
      preferred: '2',
      versions: { '2': { info: { title: 'Weather Co', description: '<p>Weather data</p>', 'x-apisguru-categories': ['weather'] } } },
    },
  }));
  assert.deepEqual([a.name, a.url, a.description, a.categories], ['Weather Co', 'https://weather.example.com', 'Weather data', ['weather']]);
});

test('api-atlas: auth/cors labels, apis.guru spec url → baseUrl, slug fallback', () => {
  const [meteo, guru, gh] = apiAtlas.parse(JSON.stringify([
    { slug: 'open-meteo', name: 'Open-Meteo', description: '<b>Weather</b> forecast', category: 'Weather', tags: ['Weather'], auth: 'None', cors: 'Yes', docsUrl: 'https://open-meteo.com/en/docs' },
    { slug: 'weather-co', name: 'Weather Co', description: 'x', category: 'Weather', auth: 'unknown', cors: null, docsUrl: 'https://api.apis.guru/v2/specs/weather.example.com/1/openapi.json', baseUrl: 'http://weather.example.com' },
    { slug: 'gh', name: 'GitHub', category: 'Development', auth: 'API Key', docsUrl: null, baseUrl: null },
  ]));
  assert.deepEqual([meteo.auth, meteo.cors, meteo.description, meteo.categories], ['none', true, 'Weather forecast', ['Weather']]);
  assert.deepEqual([guru.url, guru.auth, guru.https], ['http://weather.example.com', 'unknown', undefined]);
  assert.deepEqual([gh.auth, gh.url], ['apiKey', 'https://www.atlasapi.space/apis/gh/']);
});
