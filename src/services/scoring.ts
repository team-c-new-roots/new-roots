import type { Importance, RatedTopic, TopicName } from '@/types'
import type {
  AppData,
  AppDataWeight,
  ImportanceLevel,
  LanguageFile,
  ObtRow,
  ResultRow,
  ScoreRequest,
} from '@/types/scoring'
import { languageFigures } from './appData'

/* the household part of calculate_scores from the data team's
   new_roots_scoring.py, run in the browser so answers never leave the phone.
   the module stays the reference: __tests__/scoring.spec.ts checks this
   against its output for every suburb (scripts/make_parity_fixture.py makes
   the fixture).

   same rules as the module. a blank figure is missing and a 0 is a real one,
   like a suburb with no speakers of a language or no tram stops (agreed with
   Jake on 15 Nov). a topic is worked out from the figures it does have, and a
   topic with none is left out of the match instead of counting as 0. Either
   uses whichever of the flat and house rent is cheaper in each suburb, since
   that's the home they'd go for */

export const LEVELS: Record<Importance, ImportanceLevel> = {
  not: 'not important',
  important: 'important',
  very: 'very important',
}

const WEIGHT_FOR: Record<ImportanceLevel, number> = {
  'not important': 0,
  important: 1,
  'very important': 2,
}

interface RequestAnswers {
  censusLanguage: string | null
  importance: Record<RatedTopic, Importance>
  incomeWeekly: number
  home: Pick<ScoreRequest, 'bedrooms' | 'dwelling_type'>
}

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
      Essentials: LEVELS[importance.Essentials],
      Safety: LEVELS[importance.Safety],
      Transport: LEVELS[importance.Transport],
      Language: answers.censusLanguage ? LEVELS[importance.Language] : 'not important',
      Community: LEVELS[importance.Community],
    },
  }
}

// the most budget fit can score at a given rent share, same steps as the module
export function affordabilityCap(share: number): number {
  if (share <= 0.2) return 100
  if (share <= 0.25) return 95
  if (share <= 0.3) return 85
  if (share <= 0.35) return 30
  if (share <= 0.4) return 20
  if (share <= 0.5) return 10
  return 0
}

const COLUMN: Record<TopicName, keyof ResultRow> = {
  Affordability: 'affordability_score',
  Education: 'education_score',
  Healthcare: 'healthcare_score',
  Essentials: 'essentials_score',
  Safety: 'safety_score',
  Transport: 'transport_score',
  Language: 'language_score',
  Community: 'community_score',
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// the cheapest home with a rent figure, the first one listed if two tie.
// one metric unless it's Either
function cheapestRent(suburb: ObtRow, metrics: AppDataWeight[]): AppDataWeight | null {
  let best: AppDataWeight | null = null
  let lowest = Infinity
  for (const metric of metrics) {
    const rent = asNumber(suburb[`${metric.metric}_value`])
    if (rent === null) continue
    if (rent < lowest) {
      best = metric
      lowest = rent
    }
  }
  return best
}

// a metric's score, or null when it doesn't count. the module checks the
// figure behind the score too, so a score with a blank figure is left out
function scoreFor(
  metric: AppDataWeight,
  suburb: ObtRow,
  data: AppData,
  language: LanguageFile | null,
): number | null {
  const usable = (score: unknown, raw: unknown) => (asNumber(raw) === null ? null : asNumber(score))
  if (metric.table === 'languages') {
    if (!language) return null
    const figures = languageFigures(language, suburb.suburb_id)
    const score = figures.scores[metric.metric]
    if (metric.metric === 'language') return usable(score, figures.percent)
    if (metric.metric === 'speaker_count') return usable(score, figures.count)
    return asNumber(score)
  }
  // the export has already left out suburbs whose distances are blank
  if (metric.table === 'infrastructure') return asNumber(data.community[suburb.suburb_id])
  return usable(suburb[`${metric.metric}_score`], suburb[`${metric.metric}_value`])
}

// pandas rounds to 2 places half to even, after the same float maths
function round2(value: number | null): number | null {
  if (value === null) return null
  const scaled = value * 100
  const floor = Math.floor(scaled)
  const rest = scaled - floor
  return (rest > 0.5 || (rest === 0.5 && floor % 2 !== 0) ? floor + 1 : floor) / 100
}

// language is the household's language file, or null when there isn't one
export function scoreSuburbs(
  data: AppData,
  language: LanguageFile | null,
  request: ScoreRequest,
): ResultRow[] {
  if (!(request.income > 0)) throw new Error('income must be a positive weekly amount')

  const topics = [...new Set(data.weights.map((row) => row.topic))]
  const importance = new Map<TopicName, number>(topics.map((topic) => [topic, 1]))
  for (const [topic, level] of Object.entries(request.topic_importance)) {
    importance.set(topic as TopicName, WEIGHT_FOR[level])
  }

  const rentMetrics = data.weights.filter(
    (row) =>
      row.topic === 'Affordability' &&
      row.metric.startsWith(`rent_${request.bedrooms}br_`) &&
      (request.dwelling_type === 'both' || row.metric.endsWith(`_${request.dwelling_type}`)),
  )

  const rows = data.suburbs.map((suburb) => {
    const id = suburb.suburb_id
    const scores = new Map<TopicName, number | null>()
    const row: ResultRow = {
      suburb_id: id,
      suburb_name: suburb.suburb_name,
      affordability_score: null,
      selected_weekly_rent: null,
      rent_to_income_pct: null,
      affordability_cap: null,
      education_score: null,
      healthcare_score: null,
      essentials_score: null,
      safety_score: null,
      transport_score: null,
      language_score: null,
      community_score: null,
      overall_score: null,
      overall_rank: null,
      selected_home: null,
    }

    for (const topic of topics) {
      if (topic === 'Affordability') {
        const chosen = cheapestRent(suburb, rentMetrics)
        let fit: number | null = null
        if (chosen) {
          const rent = asNumber(suburb[`${chosen.metric}_value`])!
          const share = rent / request.income
          const cap = affordabilityCap(share)
          const score = asNumber(suburb[`${chosen.metric}_score`])
          fit = score === null ? null : Math.min(score, cap)
          row.selected_weekly_rent = round2(rent)
          row.rent_to_income_pct = round2(share * 100)
          row.affordability_cap = cap
          row.selected_home = chosen.metric.endsWith('_flat') ? 'flat' : 'house'
        }
        scores.set(topic, fit)
        row.affordability_score = round2(fit)
        continue
      }

      let weighted = 0
      let total = 0
      for (const metric of data.weights) {
        if (metric.topic !== topic) continue
        const score = scoreFor(metric, suburb, data, language)
        if (score === null) continue
        weighted += score * metric.weight
        total += metric.weight
      }
      const score = total > 0 ? weighted / total : null
      scores.set(topic, score)
      row[COLUMN[topic]] = round2(score) as never
    }

    // weighted by importance, over the topics this suburb has figures for
    let sum = 0
    let weight = 0
    for (const [topic, score] of scores) {
      const level = importance.get(topic) ?? 1
      if (score === null || level === 0) continue
      sum += score * level
      weight += level
    }
    row.overall_score = weight > 0 ? round2(sum / weight) : null
    return { row, overall: weight > 0 ? sum / weight : null }
  })

  // best first, then by name, the same order the module uses
  rows.sort(
    (a, b) =>
      (b.overall ?? -1) - (a.overall ?? -1) ||
      (a.row.suburb_name < b.row.suburb_name ? -1 : a.row.suburb_name > b.row.suburb_name ? 1 : 0),
  )
  return rows.map(({ row }, index) => ({ ...row, overall_rank: index + 1 }))
}
