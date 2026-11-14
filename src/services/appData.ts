import type { AppData, LanguageRow, MapData, ResultRow } from '@/types/scoring'

/* loads the data the browser ranks suburbs from. one file, the same for
   everyone, written from Gold by scripts/export_app_data.py and served with
   the app, so it caches and nothing personal is ever sent anywhere */

const SOURCE = `${import.meta.env.BASE_URL}data/app-data.json`

export type DataErrorKind = 'network' | 'format'

export class DataError extends Error {
  constructor(
    readonly kind: DataErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'DataError'
  }
}

// a bad file shouldn't take a screen down with it
export function parseAppData(value: unknown): AppData {
  const data = value as Partial<AppData> | null
  if (
    !data ||
    !Array.isArray(data.suburbs) ||
    !Array.isArray(data.weights) ||
    typeof data.languages !== 'object' ||
    typeof data.community !== 'object'
  ) {
    throw new DataError('format', 'app data is missing suburbs, weights, languages or community')
  }
  return {
    exported: data.exported ?? '',
    weights: data.weights,
    suburbs: data.suburbs,
    languages: data.languages ?? {},
    topLanguages: data.topLanguages ?? {},
    community: data.community ?? {},
  }
}

let cached: Promise<AppData> | null = null

export function loadAppData(): Promise<AppData> {
  if (!cached) {
    cached = (async () => {
      let response: Response
      try {
        response = await fetch(SOURCE)
      } catch (error) {
        throw new DataError('network', (error as Error).message)
      }
      if (!response.ok) throw new DataError('network', `app data ${response.status}`)
      try {
        return parseAppData(await response.json())
      } catch (error) {
        if (error instanceof DataError) throw error
        throw new DataError('format', 'app data wasn\u2019t JSON')
      }
    })()
    // a failed load shouldn't stick, Try again should fetch it fresh
    cached.catch(() => {
      cached = null
    })
  }
  return cached
}

// the shape the screens read: the household's results plus the figures behind them
export function toMapData(data: AppData, results: ResultRow[], language: string | null): MapData {
  const languages: LanguageRow[] = []
  for (const suburb of data.suburbs) {
    const id = suburb.suburb_id
    const seen = new Set<string>()
    for (const [name, percent] of data.topLanguages[id] ?? []) {
      seen.add(name)
      languages.push({
        suburb_id: id,
        language: name,
        percent_spoken: percent,
        language_score: null,
        language_ranking: null,
      })
    }
    for (const [name, bySuburb] of Object.entries(data.languages)) {
      if (seen.has(name)) continue
      const figures = bySuburb[id]
      languages.push({
        suburb_id: id,
        language: name,
        percent_spoken: figures?.percent ?? null,
        language_score: figures?.scores.language ?? null,
        language_ranking: null,
      })
    }
  }
  return {
    results,
    obt: data.suburbs,
    lookup: data.weights.map((row) => ({
      table: row.table,
      topic: row.topic,
      metric: row.metric,
      weighting_pct: row.weight,
      to_display: 'value',
    })),
    languages,
    infrastructure: [],
    selectedLanguage: language,
  }
}
