import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADVISOR_NETWORK_ERROR,
  fetchWithNetworkRetry,
} from '../src/lib/networkRetry.js'

test('advisor requests retry one transient fetch failure', async () => {
  let calls = 0
  const response = { ok: true }
  const result = await fetchWithNetworkRetry('/chat', {}, {
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) throw new TypeError('Failed to fetch')
      return response
    },
    wait: async () => {},
  })

  assert.equal(result, response)
  assert.equal(calls, 2)
})

test('persistent network failures become a useful message', async () => {
  let calls = 0
  await assert.rejects(fetchWithNetworkRetry('/chat', {}, {
    fetchImpl: async () => {
      calls += 1
      throw new TypeError('Failed to fetch')
    },
    wait: async () => {},
  }), new RegExp(ADVISOR_NETWORK_ERROR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.equal(calls, 2)
})

test('aborted requests are not retried or relabeled', async () => {
  let calls = 0
  const abortError = new Error('cancelled')
  abortError.name = 'AbortError'
  await assert.rejects(fetchWithNetworkRetry('/chat', {}, {
    fetchImpl: async () => {
      calls += 1
      throw abortError
    },
    wait: async () => {},
  }), error => error === abortError)
  assert.equal(calls, 1)
})
