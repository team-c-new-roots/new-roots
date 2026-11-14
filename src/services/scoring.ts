import type { Importance, RatedTopic, TopicName } from '@/types'
import type { AppData, ImportanceLevel, ResultRow, ScoreRequest } from '@/types/scoring'

/* the household part of calculate_scores from the data team's
   new_roots_scoring.py, run in the browser so answers never leave the phone.
   the data team's pipeline does everything else in Python, and the module
   stays the reference: __tests__/scoring.spec.ts checks this against its
   output (scripts/make_parity_fixture.py makes the fixture).

   one deliberate difference, agreed with the data team: a missing figure is
   left out and the rest reweighted, where the module counts it as 0. so a
   suburb with no rent figure gets no budget fit at all rather than 0, and is
   marked as missing instead of sinking to the bottom */

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
  Safety: 'safety_score',
  Transport: 'transport_score',
  Language: 'language_score',
  Community: 'community_score',
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// pandas rounds half to even after its float maths, so round the same way
function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100
}

export function scoreSuburbs(data: AppData, request: ScoreRequest): ResultRow[] {
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
  const language = request.selected_language
    ? (data.languages[request.selected_language] ?? {})
    : {}

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
      safety_score: null,
      transport_score: null,
      language_score: null,
      community_score: null,
      overall_score: null,
      overall_rank: null,
    }

    for (const topic of topics) {
      const metrics =
        topic === 'Affordability'
          ? rentMetrics
          : data.weights.filter((item) => item.topic === topic)
      let weighted = 0
      let total = 0
      let rentTotal = 0
      let capTotal = 0

      for (const metric of metrics) {
        let score =
          metric.table === 'languages'
            ? asNumber(language[id]?.scores[metric.metric])
            : metric.table === 'infrastructure'
              ? asNumber(data.community[id])
              : asNumber(suburb[`${metric.metric}_score`])

        if (topic === 'Affordability') {
          const rent = asNumber(suburb[`${metric.metric}_value`])
          if (rent === null || score === null) continue
          const cap = affordabilityCap(rent / request.income)
          score = Math.min(score, cap)
          rentTotal += rent * metric.weight
          capTotal += cap * metric.weight
        }
        if (score === null) continue
        weighted += score * metric.weight
        total += metric.weight
      }

      const score = total > 0 ? weighted / total : null
      scores.set(topic, score)
      row[COLUMN[topic]] = round2(score) as never
      if (topic === 'Affordability' && total > 0) {
        row.selected_weekly_rent = round2(rentTotal / total)
        row.rent_to_income_pct = round2((rentTotal / total / request.income) * 100)
        row.affordability_cap = round2(capTotal / total)
      }
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
