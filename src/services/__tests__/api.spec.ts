import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScoreRequest } from '@/types/api'

// import.meta.env is read when the module loads, so each mode gets a fresh copy
async function loadApi(resultsApi?: string) {
  vi.resetModules()
  vi.stubEnv('VITE_RESULTS_API', resultsApi ?? '')
  return import('../api')
}

const request: ScoreRequest = {
  selected_language: 'Dari',
  bedrooms: 4,
  dwelling_type: 'both',
  income: 1654.58,
  topic_importance: {
    Affordability: 'very important',
    Education: 'important',
    Healthcare: 'important',
    Safety: 'not important',
    Transport: 'important',
    Language: 'very important',
    Community: 'important',
  },
}

const response = { results: [], obt: [], lookup: [], languages: [], infrastructure: [] }

describe('toScoreRequest', () => {
  it('sends only what scoring needs, with affordability always first (US 2.2)', async () => {
    const { toScoreRequest } = await loadApi()
    const sent = toScoreRequest({
      censusLanguage: null,
      importance: {
        Education: 'very',
        Healthcare: 'important',
        Transport: 'not',
        Language: 'very',
        Community: 'important',
        Safety: 'not',
      },
      incomeWeekly: 700,
      home: { bedrooms: 1, dwelling_type: 'flat' },
    })
    expect(sent.topic_importance.Affordability).toBe('very important')
    expect(sent.topic_importance.Education).toBe('very important')
    expect(sent.topic_importance.Safety).toBe('not important')
    // no language chosen, so language can't count however it was rated
    expect(sent.topic_importance.Language).toBe('not important')
    expect(Object.keys(sent).sort()).toEqual(
      ['bedrooms', 'dwelling_type', 'income', 'selected_language', 'topic_importance'].sort(),
    )
  })
})

describe('fetchResults', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('loads the saved example when no API is set, without sending any answers', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json(response))
    const { fetchResults, usingExample } = await loadApi()
    expect(usingExample).toBe(true)
    await fetchResults(request)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('data/example-results.json')
    expect((init as RequestInit | undefined)?.body).toBeUndefined()
  })

  it('posts the answers in the body, never the address, once the API is set', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json(response))
    const { fetchResults, usingExample } = await loadApi('/api/score')
    expect(usingExample).toBe(false)
    await fetchResults(request)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/score')
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual(request)
  })

  it('says the server failed when the API answers with an error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('oops', { status: 500 }))
    const { fetchResults } = await loadApi('/api/score')
    await expect(fetchResults(request)).rejects.toMatchObject({ kind: 'server' })
  })

  it('says the network failed when the request never arrives', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    const { fetchResults } = await loadApi('/api/score')
    await expect(fetchResults(request)).rejects.toMatchObject({ kind: 'network' })
  })

  it('rejects a response without results rather than breaking a screen', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ hello: 'world' }))
    const { fetchResults } = await loadApi('/api/score')
    await expect(fetchResults(request)).rejects.toMatchObject({ kind: 'format' })
  })
})
