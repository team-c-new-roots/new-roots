import type { BudgetStatus, TopicName } from '@/types'
import type { LanguageRow, MapData, ObtRow, ResultRow } from '@/types/scoring'
import { METRICS } from '@/data/metrics'

/* turns the API's rows into what the screens show. ranking itself happens in
   the scoring module, this only sorts and labels what comes back */

// rent as a share of income. these line up with affordability_cap in the
// scoring module, where the score drops from 85 to 30 past 30%
export const WITHIN_MAX = 30
export const CLOSE_MAX = 35

export interface SuburbResult {
  id: string
  name: string
  row: ResultRow
  obt: ObtRow | null
  status: BudgetStatus
  // null when the rental report has no figure for the home asked about
  rent: number | null
  match: number | null
  // position among suburbs within or close to budget, null for the rest
  rank: number | null
  // dollars above the budget, for close and above budget suburbs
  overBy: number | null
}

// the map colours suburbs by their match in fixed bands of 20, the same
// numbers the labels show, so a 54 always looks like a 54
export const MATCH_BANDS = [
  { band: 1, from: 0, to: 19 },
  { band: 2, from: 20, to: 39 },
  { band: 3, from: 40, to: 59 },
  { band: 4, from: 60, to: 79 },
  { band: 5, from: 80, to: 100 },
] as const

export function bandFor(score: number | null): number | undefined {
  if (score === null) return undefined
  const rounded = Math.round(score)
  return MATCH_BANDS.find((band) => rounded >= band.from && rounded <= band.to)?.band ?? 5
}

export interface Derived {
  all: SuburbResult[]
  ranked: SuburbResult[]
  // when nothing fits, the cheapest suburbs with a rent figure
  closest: SuburbResult[]
  byId: Map<string, SuburbResult>
}

const STATUS_ORDER: Record<BudgetStatus, number> = { within: 0, close: 1, above: 2, noData: 3 }

// the census adds " (Vic.)" to names other states share
export function cleanName(name: string): string {
  return name.replace(/\s*\((Vic\.?|VIC)\)\s*$/, '').trim()
}

/* the scoring module currently sends 0 rather than nothing when a suburb has
   no rent figure, so 0 has to read as missing too. otherwise 0% of income
   would count as within budget */
export function budgetStatus(row: ResultRow): BudgetStatus {
  const rent = row.selected_weekly_rent
  const share = row.rent_to_income_pct
  if (rent === null || rent <= 0 || share === null || share <= 0) return 'noData'
  if (share <= WITHIN_MAX) return 'within'
  if (share <= CLOSE_MAX) return 'close'
  return 'above'
}

function byScore(a: SuburbResult, b: SuburbResult): number {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    (b.row.overall_score ?? -1) - (a.row.overall_score ?? -1) ||
    (a.rent ?? Infinity) - (b.rent ?? Infinity) ||
    a.name.localeCompare(b.name)
  )
}

export function buildResults(data: MapData, budgetWeekly: number): Derived {
  const obtById = new Map(data.obt.map((row) => [row.suburb_id, row]))

  const all = data.results.map<SuburbResult>((row) => {
    const status = budgetStatus(row)
    const rent = status === 'noData' ? null : row.selected_weekly_rent
    return {
      id: row.suburb_id,
      name: cleanName(row.suburb_name),
      row,
      obt: obtById.get(row.suburb_id) ?? null,
      status,
      rent,
      match: row.overall_score === null ? null : Math.round(row.overall_score),
      rank: null,
      overBy: rent !== null && rent > budgetWeekly ? Math.round(rent - budgetWeekly) : null,
    }
  })

  // within budget first, then close, each by the scoring module's score (US 2.3)
  const ranked = all
    .filter((suburb) => suburb.status === 'within' || suburb.status === 'close')
    .sort(byScore)
  ranked.forEach((suburb, index) => (suburb.rank = index + 1))

  const closest =
    ranked.length > 0
      ? []
      : all
          .filter((suburb) => suburb.rent !== null)
          .sort((a, b) => (a.rent ?? 0) - (b.rent ?? 0))
          .slice(0, 3)

  return { all, ranked, closest, byId: new Map(all.map((suburb) => [suburb.id, suburb])) }
}

function languagesFor(data: MapData, id: string): LanguageRow[] {
  return data.languages.filter((row) => row.suburb_id === id)
}

// the four most spoken languages, leaving out empty rows the data sometimes has
export function topLanguages(data: MapData, id: string, limit = 4) {
  return languagesFor(data, id)
    .filter((row) => (row.percent_spoken ?? 0) > 0)
    .sort((a, b) => (b.percent_spoken ?? 0) - (a.percent_spoken ?? 0))
    .slice(0, limit)
    .map((row) => ({ language: row.language, percent: row.percent_spoken as number }))
}

// null means too few speakers to report. the census perturbs small counts, so
// 0 isn't trustworthy enough to show as 0% (US 3.1)
export function languageShare(data: MapData, id: string, censusName: string): number | null {
  const row = languagesFor(data, id).find((item) => item.language === censusName)
  const percent = row?.percent_spoken ?? null
  return percent !== null && percent > 0 ? percent : null
}

export function metricValue(obt: ObtRow | null, metric: string): number | null {
  const value = obt?.[`${metric}_value`]
  return typeof value === 'number' ? value : null
}

export interface Insight {
  metric: string
  rank: number
  total: number
}

// how many suburbs have a ranking for each metric, worked out once per response
const totalsCache = new WeakMap<ObtRow[], Map<string, number>>()

function rankTotals(obt: ObtRow[]): Map<string, number> {
  let totals = totalsCache.get(obt)
  if (!totals) {
    totals = new Map()
    for (const metric of Object.keys(METRICS)) {
      totals.set(metric, obt.filter((row) => typeof row[`${metric}_ranking`] === 'number').length)
    }
    totalsCache.set(obt, totals)
  }
  return totals
}

/* the three metrics a suburb ranks best and worst on, out of the topics the
   household counted. only the rent for their home size, and nothing about
   crime unless they chose to count it */
export function insights(
  data: MapData,
  suburb: SuburbResult,
  counted: Set<TopicName>,
  rentMetric: string,
): { best: Insight[]; worst: Insight[] } {
  const totals = rankTotals(data.obt)
  const items: Insight[] = []

  for (const [metric, info] of Object.entries(METRICS)) {
    if (!counted.has(info.topic)) continue
    if (info.topic === 'Affordability' && metric !== rentMetric) continue
    const rank = suburb.obt?.[`${metric}_ranking`]
    const total = totals.get(metric) ?? 0
    if (typeof rank === 'number' && total > 0) items.push({ metric, rank: Math.round(rank), total })
  }

  const share = (item: Insight) => item.rank / item.total
  const sorted = [...items].sort((a, b) => share(a) - share(b))
  const best = sorted.slice(0, 3)
  const worst = sorted.slice(3).reverse().slice(0, 3)
  return { best, worst }
}
