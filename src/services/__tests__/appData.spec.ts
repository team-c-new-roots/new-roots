import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '@/types/scoring'

async function fresh() {
  vi.resetModules()
  return import('../appData')
}

const minimal: AppData = {
  exported: '2026-11-15',
  weights: [{ topic: 'Education', table: 'obt', metric: 'gp_proximity', weight: 100 }],
  suburbs: [{ suburb_id: 'a', suburb_name: 'Alpha', suburb_area_km2: 2 }],
  languages: { Dari: { a: [2.5, 60] } },
  topLanguages: { a: [['English', 40]] },
  community: { a: 80 },
}

describe('loadAppData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the exported file once and keeps it', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json(minimal))
    const { loadAppData } = await fresh()
    await loadAppData()
    await loadAppData()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('data/app-data.json')
  })

  it('reports a network failure, then tries again next time', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { loadAppData } = await fresh()
    await expect(loadAppData()).rejects.toMatchObject({ kind: 'network' })
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(minimal))
    await expect(loadAppData()).resolves.toMatchObject({ exported: '2026-11-15' })
  })

  it('rejects a file without suburbs rather than breaking a screen', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ hello: 'world' }))
    const { loadAppData } = await fresh()
    await expect(loadAppData()).rejects.toMatchObject({ kind: 'format' })
  })
})

describe('toMapData', () => {
  it('lists each suburb’s top languages and every offered language', async () => {
    const { toMapData } = await fresh()
    const map = toMapData(minimal, [], 'Dari')
    expect(map.languages.map((row) => row.language)).toEqual(['English', 'Dari'])
    expect(map.languages[1]).toMatchObject({ percent_spoken: 2.5, language_score: 60 })
    expect(map.selectedLanguage).toBe('Dari')
  })
})
