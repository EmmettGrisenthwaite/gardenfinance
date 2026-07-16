import test from 'node:test'
import assert from 'node:assert/strict'
import { collectWebSources, compactWebSources } from '../src/lib/webSources.js'

test('web source collector prefers citations and rejects non-web URLs', () => {
  const sets = { cited: new Map(), searched: new Map() }
  collectWebSources({
    type: 'text',
    citations: [
      { type: 'web_search_result_location', url: 'https://ally.com/rates', title: 'Ally rates' },
      { type: 'web_search_result_location', source: 'https://marcus.com/rates', title: 'Marcus rates' },
      { type: 'web_search_result_location', url: 'javascript:alert(1)', title: 'Unsafe' },
    ],
    content: [{ type: 'web_search_result', url: 'https://bankrate.com/compare', title: 'Comparison' }],
  }, sets)

  assert.deepEqual(compactWebSources(sets).map(source => source.url), [
    'https://ally.com/rates',
    'https://marcus.com/rates',
  ])
})

test('raw search fallback keeps one link per hostname and caps the row', () => {
  const sets = { cited: new Map(), searched: new Map() }
  collectWebSources([
    { type: 'web_search_result', url: 'https://www.ally.com/one', title: 'One' },
    { type: 'web_search_result', url: 'https://ally.com/two', title: 'Two' },
    { type: 'web_search_result', url: 'https://marcus.com/one', title: 'Marcus' },
    { type: 'web_search_result', url: 'https://bankrate.com/one', title: 'Bankrate' },
  ], sets)

  assert.deepEqual(compactWebSources(sets, 2).map(source => source.url), [
    'https://www.ally.com/one',
    'https://marcus.com/one',
  ])
})
