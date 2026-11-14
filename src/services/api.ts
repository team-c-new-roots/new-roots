import type { Importance, RatedTopic } from '@/types'
import type { ImportanceLevel, MapData, ScoreRequest } from '@/types/api'

/* the only file that talks to the scoring API.
   VITE_RESULTS_API is the address answers are posted to, /api/score say,
   once mark's API is live on the same site. without it the app loads a saved
   response from the data team so every screen works before then, it just
   doesn't change with the answers */

const RESULTS_API: string | undefined = import.meta.env.VITE_RESULTS_API || undefined
const EXAMPLE = `${import.meta.env.BASE_URL}data/example-results.json`
const TIMEOUT_MS = 20000

export const usingExample = RESULTS_API === undefined

// what the saved example was ranked for: a 2-bed home, house or flat, on
// $1,500 a week with Dari. its rents describe that home, so they're labelled
// as that home rather than the one the person asked for
export const EXAMPLE_HOME = { type: 'either', bedrooms: 2 } as const
export const EXAMPLE_RENT_METRIC = 'rent_2br_flat'

export type ResultsErrorKind = 'network' | 'server' | 'format'

export class ResultsError extends Error {
  constructor(
    readonly kind: ResultsErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'ResultsError'
  }
}

export const LEVELS: Record<Importance, ImportanceLevel> = {
  not: 'not important',
  important: 'important',
  very: 'very important',
}

interface RequestAnswers {
  censusLanguage: string | null
  importance: Record<RatedTopic, Importance>
  incomeWeekly: number
  home: Pick<ScoreRequest, 'bedrooms' | 'dwelling_type'>
}

// only what scoring needs. no household make-up, no payment names, nothing
// that says who someone is
export function toScoreRequest(answers: RequestAnswers): ScoreRequest {
  const { importance } = answers
  return {
    selected_language: answers.censusLanguage,
    bedrooms: answers.home.bedrooms,
    dwelling_type: answers.home.dwelling_type,
    income: answers.incomeWeekly,
    topic_importance: {
      // never rated, suburbs within budget always come first (US 2.2)
      Affordability: 'very important',
      Education: LEVELS[importance.Education],
      Healthcare: LEVELS[importance.Healthcare],
      Safety: LEVELS[importance.Safety],
      Transport: LEVELS[importance.Transport],
      Language: answers.censusLanguage ? LEVELS[importance.Language] : 'not important',
      Community: LEVELS[importance.Community],
    },
  }
}

// a bad response shouldn't take a screen down with it
export function parseMapData(value: unknown): MapData {
  const data = value as Partial<MapData> | null
  if (!data || !Array.isArray(data.results) || !Array.isArray(data.obt)) {
    throw new ResultsError('format', 'results response is missing results or obt')
  }
  return {
    results: data.results,
    obt: data.obt,
    lookup: Array.isArray(data.lookup) ? data.lookup : [],
    languages: Array.isArray(data.languages) ? data.languages : [],
    infrastructure: Array.isArray(data.infrastructure) ? data.infrastructure : [],
    selectedLanguage: data.selectedLanguage ?? null,
  }
}

let example: Promise<MapData> | null = null

async function getJson(url: string, init: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ResultsError('network', (error as Error).message)
  }
  if (!response.ok) throw new ResultsError('server', `results ${response.status}`)
  try {
    return await response.json()
  } catch {
    throw new ResultsError('format', 'results response wasn\u2019t JSON')
  }
}

export async function fetchResults(request: ScoreRequest, signal?: AbortSignal): Promise<MapData> {
  if (!RESULTS_API) {
    // the same file for everyone, so fetch it once
    if (!example) {
      example = getJson(EXAMPLE, {}).then(parseMapData)
      example.catch(() => {
        example = null
      })
    }
    return example
  }

  // our own timeout, joined to the caller's abort
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    // answers go in the body, never the address, because hosts log addresses
    const body = await getJson(RESULTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    return parseMapData(body)
  } catch (error) {
    if ((error as Error).name === 'AbortError' && !signal?.aborted) {
      throw new ResultsError('network', 'results timed out')
    }
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
