import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData, LanguageFile, LanguageIndexEntry } from '@/types/scoring'

async function fresh() {
  vi.resetModules()
  return import('../appData')
}

const minimal: AppData = {
  exported: '2026-11-15',
  weights: [{ topic: 'Education', table: 'obt', metric: 'gp_proximity', weight: 100 }],
  suburbs: [
    { suburb_id: 'a', suburb_name: 'Alpha', suburb_area_km2: 2 },
    { suburb_id: 'b', suburb_name: 'Beta', suburb_area_km2: 3 },
  ],
  topLanguages: { a: [['English', 40]] },
  languageLabels: { English: 'English' },
  community: { a: 80 },
}

const index: LanguageIndexEntry[] = [
  {
    name: 'Persian (excluding Dari)',
    label: 'Farsi (Persian)',
    speakers: 21475,
    file: 'persian-excluding-dari',
  },
]

const persian: LanguageFile = {
  name: 'Persian (excluding Dari)',
  label: 'Farsi (Persian)',
  metrics: ['language', 'speaker_count'],
  suburbs: { a: [2.5, 90, 60, 70] },
}

describe('loading', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the exported app data once and keeps it', async () => {
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

  it('finds a language’s file through the index, and fetches it only once', async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockImplementation(async (url) =>
        Response.json(String(url).endsWith('index.json') ? index : persian),
      )
    const { loadLanguage } = await fresh()
    await loadLanguage('Persian (excluding Dari)')
    const file = await loadLanguage('Persian (excluding Dari)')
    expect(file.label).toBe('Farsi (Persian)')
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.filter((url) => url.endsWith('persian-excluding-dari.json'))).toHaveLength(1)
  })

  it('says so when a language isn’t in the index', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(index))
    const { loadLanguage } = await fresh()
    await expect(loadLanguage('Klingon')).rejects.toMatchObject({ kind: 'format' })
  })
})

describe('language figures', () => {
  it('reads each metric’s score by name', async () => {
    const { languageFigures } = await fresh()
    expect(languageFigures(persian, 'a')).toEqual({
      percent: 2.5,
      count: 90,
      scores: { language: 60, speaker_count: 70 },
    })
  })

  it('reads a suburb missing from the file as nobody speaking it', async () => {
    const { languageFigures } = await fresh()
    expect(languageFigures(persian, 'b')).toEqual({
      percent: 0,
      count: 0,
      scores: { language: 0, speaker_count: 0 },
    })
  })
})

describe('toMapData', () => {
  it('lists each suburb’s top languages and the household’s, with display names', async () => {
    const { toMapData } = await fresh()
    const map = toMapData(minimal, [], persian)
    const forA = map.languages.filter((row) => row.suburb_id === 'a')
    expect(forA.map((row) => row.language)).toEqual(['English', 'Persian (excluding Dari)'])
    expect(forA[1]).toMatchObject({ percent_spoken: 2.5, language_score: 60 })
    expect(map.selectedLanguage).toBe('Persian (excluding Dari)')
    expect(map.languageLabels['Persian (excluding Dari)']).toBe('Farsi (Persian)')
  })
})
