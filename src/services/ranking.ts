import type {
  BudgetStatus,
  Importance,
  Preferences,
  RankedSuburb,
  RankingResult,
  Suburb,
  Topic,
} from '@/types'
import { medianFor } from './household'

/* the rules from the report, in one place so the data team can tune them:
   - every topic scores 0 to 100
   - Not important counts 0, Important 1, Very important 2
   - budget fit always counts 2, double an Important topic
   - a missing figure drops out of the average, it never scores 0
   - community only reorders, it never filters anything out
   - within budget comes first, then close to budget, best match first */

export const WEIGHT: Record<Importance, number> = { not: 0, important: 1, very: 2 }
export const BUDGET_WEIGHT = 2
// close to budget means up to 10% over
export const CLOSE_MARGIN = 0.1

const TOPICS: Topic[] = ['community', 'essentials', 'crime']

// 100 down to 80 across the budget, then falls to 0 at 30% over
export function budgetFit(median: number, budget: number): number {
  const ratio = median / budget
  if (ratio <= 0.7) return 100
  if (ratio <= 1) return Math.round(100 - ((ratio - 0.7) / 0.3) * 20)
  // max(0) also catches -0 from floating point right on the 30% line
  if (ratio <= 1.3) return Math.max(0, Math.round(80 - ((ratio - 1) / 0.3) * 80))
  return 0
}

export function statusFor(median: number, budget: number): BudgetStatus {
  if (median <= budget) return 'within'
  if (median <= budget * (1 + CLOSE_MARGIN)) return 'close'
  return 'over'
}

const STATUS_ORDER: Record<BudgetStatus, number> = { within: 0, close: 1, over: 2, noData: 3 }

export function rankSuburbs(suburbs: Suburb[], prefs: Preferences): RankingResult {
  const language = prefs.communityLanguage

  // community is relative: the suburb with the biggest share of speakers scores 100
  const topShare = language
    ? Math.max(0, ...suburbs.map((item) => item.languages?.[language] ?? 0))
    : 0

  const all: RankedSuburb[] = suburbs.map((suburb) => {
    const found = medianFor(suburb.rents, prefs.bedrooms, prefs.homeType)
    const median = found ? found.median : null

    const share = language ? (suburb.languages?.[language] ?? null) : null
    const community =
      share === null ? null : topShare > 0 ? Math.round((share / topShare) * 100) : 0

    const scores = {
      budget: median === null ? null : budgetFit(median, prefs.budget),
      community,
      essentials: suburb.essentialsScore,
      crime: suburb.crimeScore,
    }

    const counted: Record<Topic, boolean> = {
      community: language !== null && WEIGHT[prefs.importance.community] > 0,
      essentials: WEIGHT[prefs.importance.essentials] > 0,
      crime: WEIGHT[prefs.importance.crime] > 0,
    }

    let match: number | null = null
    if (scores.budget !== null) {
      let total = scores.budget * BUDGET_WEIGHT
      let weights = BUDGET_WEIGHT
      for (const topic of TOPICS) {
        const score = scores[topic]
        if (counted[topic] && score !== null) {
          const weight = WEIGHT[prefs.importance[topic]]
          total += score * weight
          weights += weight
        }
      }
      match = Math.round(total / weights)
    }

    return {
      suburb,
      home: found ? found.home : null,
      median,
      status: median === null ? 'noData' : statusFor(median, prefs.budget),
      difference: median === null ? null : median - prefs.budget,
      scores,
      counted,
      match,
      rank: null,
    }
  })

  const ranked = all
    .filter((item) => item.status === 'within' || item.status === 'close')
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (b.match ?? 0) - (a.match ?? 0) ||
        (a.median ?? 0) - (b.median ?? 0),
    )
    .map((item, index) => ({ ...item, rank: index + 1 }))

  const rankById = new Map(ranked.map((item) => [item.suburb.id, item.rank]))
  const withRanks = all.map((item) => ({ ...item, rank: rankById.get(item.suburb.id) ?? null }))

  // when nothing fits, show how far over the cheapest three are rather than a blank page
  const closest =
    ranked.length > 0
      ? []
      : withRanks
          .filter((item) => item.median !== null)
          .sort((a, b) => (a.median ?? 0) - (b.median ?? 0))
          .slice(0, 3)

  return { ranked, all: withRanks, closest }
}
