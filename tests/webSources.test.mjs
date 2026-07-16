import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectWebSources,
  compactWebSources,
  limitGuideLinks,
  needsActionLinks,
} from '../src/lib/webSources.js'

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

  assert.deepEqual(compactWebSources(sets), [])
  assert.deepEqual(compactWebSources(sets, { limit: 2, allowSearchFallback: true }).map(source => source.url), [
    'https://www.ally.com/one',
    'https://marcus.com/one',
  ])
})

test('chat links are capped at three even when more sources are cited', () => {
  const sets = { cited: new Map(), searched: new Map() }
  collectWebSources([
    { type: 'web_search_result_location', url: 'https://ally.com/rates' },
    { type: 'web_search_result_location', url: 'https://marcus.com/rates' },
    { type: 'web_search_result_location', url: 'https://discover.com/rates' },
    { type: 'web_search_result_location', url: 'https://sofi.com/rates' },
  ], sets)

  assert.equal(compactWebSources(sets).length, 3)
})

test('raw fallback is reserved for explicit links and concrete setup actions', () => {
  assert.equal(needsActionLinks('How does a Roth IRA work?'), false)
  assert.equal(needsActionLinks('How much should I keep in savings?'), false)
  assert.equal(needsActionLinks('Send me the official source'), true)
  assert.equal(needsActionLinks('Help me open a Roth IRA'), true)
  assert.equal(needsActionLinks('Where can I apply for health insurance?'), true)
})

test('a guide keeps no more than three safe unique links across all steps', () => {
  const guide = limitGuideLinks({
    title: 'Open an account',
    steps: [
      { text: 'Compare', resources: [
        { label: 'Ally', url: 'https://ally.com/open' },
        { label: 'Unsafe', url: 'javascript:alert(1)' },
      ] },
      { text: 'Choose', resources: [
        { label: 'Ally again', url: 'https://ally.com/open' },
        { label: 'Marcus', url: 'https://marcus.com/open' },
        { label: 'SoFi', url: 'https://sofi.com/open' },
        { label: 'Discover', url: 'https://discover.com/open' },
      ] },
    ],
  })

  assert.deepEqual(guide.steps.flatMap(step => step.resources ?? []).map(resource => resource.label), [
    'Ally', 'Marcus', 'SoFi',
  ])
})
