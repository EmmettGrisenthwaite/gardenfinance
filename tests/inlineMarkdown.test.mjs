import test from 'node:test'
import assert from 'node:assert/strict'
import { splitInlineMarkdown } from '../src/lib/inlineMarkdown.js'

const types = text => splitInlineMarkdown(text).map(t => `${t.type}:${t.value}`)

test('single-asterisk emphasis becomes italic, not literal asterisks', () => {
  // The production bug: this reached the screen as "*before*".
  assert.deepEqual(
    types('goes to savings *before* the card'),
    ['text:goes to savings ', 'italic:before', 'text: the card'],
  )
})

test('bold still works and never parses as nested italics', () => {
  assert.deepEqual(types('pay the **full balance** now'), ['text:pay the ', 'bold:full balance', 'text: now'])
})

test('bold and italic in one line keep their own marks', () => {
  assert.deepEqual(
    types('**Why:** stop the bleeding *first*'),
    ['bold:Why:', 'text: stop the bleeding ', 'italic:first'],
  )
})

test('a lone asterisk is left alone', () => {
  // "$5 * 3" must not open an emphasis run that swallows the rest of the line.
  assert.deepEqual(types('roughly $5 * 3 a week'), ['text:roughly $5 * 3 a week'])
})

test('an unclosed emphasis mark stays literal', () => {
  assert.deepEqual(types('a 5 * b and *dangling'), ['text:a 5 * b and *dangling'])
})

test('plain text passes through as one token', () => {
  assert.deepEqual(types('no marks here'), ['text:no marks here'])
})

test('empty and nullish input yield no tokens', () => {
  assert.deepEqual(splitInlineMarkdown(''), [])
  assert.deepEqual(splitInlineMarkdown(null), [])
  assert.deepEqual(splitInlineMarkdown(undefined), [])
})
