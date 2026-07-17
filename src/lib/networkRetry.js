export const ADVISOR_NETWORK_ERROR = 'The advisor could not connect. Check your connection and try again.'

export function isRetriableNetworkError(error) {
  if (error?.name === 'AbortError') return false
  return error instanceof TypeError
    || /failed to fetch|networkerror|load failed|network request failed/i.test(String(error?.message || error))
}

export async function fetchWithNetworkRetry(input, init, {
  retries = 1,
  retryDelayMs = 350,
  fetchImpl = globalThis.fetch,
  wait = (delay) => new Promise(resolve => setTimeout(resolve, delay)),
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchImpl(input, init)
    } catch (error) {
      if (!isRetriableNetworkError(error)) throw error
      if (attempt >= retries || init?.signal?.aborted) {
        throw new Error(ADVISOR_NETWORK_ERROR, { cause: error })
      }
      await wait(retryDelayMs)
    }
  }
}
