import type {
  AppData,
  LanguageFigures,
  LanguageFile,
  LanguageIndexEntry,
  LanguageRow,
  MapData,
  ResultRow,
} from '@/types/scoring'

/* loads the data the browser ranks suburbs from. one file, the same for
   everyone, written from Gold by scripts/export_app_data.py and served with
   the app, so it caches and nothing personal is ever sent anywhere */

const DATA = `${import.meta.env.BASE_URL}data/`
const SOURCE = `${DATA}app-data.json`

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
    typeof data.community !== 'object'
  ) {
    throw new DataError('format', 'app data is missing suburbs, weights or community')
  }
  return {
    exported: data.exported ?? '',
    weights: data.weights,
    suburbs: data.suburbs,
    topLanguages: data.topLanguages ?? {},
    languageLabels: data.languageLabels ?? {},
    community: data.community ?? {},
  }
}

// fetch a JSON file, keeping network and format failures apart for the error screen
async function getJson(url: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    throw new DataError('network', (error as Error).message)
  }
  if (!response.ok) throw new DataError('network', `${url} ${response.status}`)
  try {
    return await response.json()
  } catch {
    throw new DataError('format', `${url} wasn\u2019t JSON`)
  }
}

// each file loads once. a failed load isn't kept, so Try again fetches it fresh
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null
  return () => {
    if (!cached) {
      cached = load()
      cached.catch(() => {
        cached = null
      })
    }
    return cached
  }
}

export const loadAppData = once(async () => parseAppData(await getJson(SOURCE)))

export const loadLanguageIndex = once(async () => {
  const index = await getJson(`${DATA}languages/index.json`)
  if (!Array.isArray(index)) throw new DataError('format', 'the language list isn\u2019t a list')
  return index as LanguageIndexEntry[]
})

const languageFiles = new Map<string, Promise<LanguageFile>>()

// one language's figures for every suburb, fetched when someone picks it
export function loadLanguage(name: string): Promise<LanguageFile> {
  let file = languageFiles.get(name)
  if (!file) {
    file = (async () => {
      const entry = (await loadLanguageIndex()).find((item) => item.name === name)
      if (!entry) throw new DataError('format', `no language called ${name}`)
      const data = (await getJson(`${DATA}languages/${entry.file}.json`)) as LanguageFile
      if (!data || typeof data.suburbs !== 'object' || !Array.isArray(data.metrics)) {
        throw new DataError('format', `${entry.file}.json is missing its suburbs`)
      }
      return data
    })()
    languageFiles.set(name, file)
    file.catch(() => languageFiles.delete(name))
  }
  return file
}

const NO_SPEAKERS = (metrics: string[]): LanguageFigures => ({
  percent: 0,
  count: 0,
  scores: Object.fromEntries(metrics.map((metric) => [metric, 0])),
})

// a suburb missing from the file has nobody speaking it, so every figure is 0
export function languageFigures(file: LanguageFile, id: string): LanguageFigures {
  const row = file.suburbs[id]
  if (!row) return NO_SPEAKERS(file.metrics)
  return {
    percent: row[0] ?? null,
    count: row[1] ?? null,
    scores: Object.fromEntries(
      file.metrics.map((metric, index) => [metric, row[index + 2] ?? null]),
    ),
  }
}

// the shape the screens read: the household's results plus the figures behind them
export function toMapData(
  data: AppData,
  results: ResultRow[],
  language: LanguageFile | null,
): MapData {
  const languages: LanguageRow[] = []
  for (const suburb of data.suburbs) {
    const id = suburb.suburb_id
    for (const [name, percent] of data.topLanguages[id] ?? []) {
      if (name === language?.name) continue
      languages.push({
        suburb_id: id,
        language: name,
        percent_spoken: percent,
        language_score: null,
        language_ranking: null,
      })
    }
    if (language) {
      const figures = languageFigures(language, id)
      languages.push({
        suburb_id: id,
        language: language.name,
        percent_spoken: figures.percent,
        language_score: figures.scores.language ?? null,
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
    selectedLanguage: language?.name ?? null,
    languageLabels: {
      ...data.languageLabels,
      ...(language ? { [language.name]: language.label } : {}),
    },
  }
}
