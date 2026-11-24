/* five years of median rents for the suburb page (US 1.4), from
   scripts/export_rent_trend.py. the Rental Report counts some suburbs
   together as one area, so the line belongs to the area, not the suburb */

type Series = (number | null)[]

export interface RentTrendFile {
  // quarter ends, oldest first
  periods: string[]
  melbourne: Record<string, Series>
  suburbs: Record<string, { area: string; rents: Record<string, Series> }>
}

export interface RentTrend {
  area: string
  // false when the home asked for had too few leases, so this is all homes
  ownHome: boolean
  periods: string[]
  rents: Series
  melbourne: Series
  // percent change over the five years, 12 for 12%
  change: number
  melbourneChange: number
}

// within this many points of Melbourne reads as about the same
export const SAME_AS_MELBOURNE = 3

let request: Promise<RentTrendFile> | null = null

export function loadRentTrend(): Promise<RentTrendFile> {
  if (!request) {
    const pending = fetch(`${import.meta.env.BASE_URL}data/rent-trend.json`).then((response) => {
      if (!response.ok) throw new Error(`rent trend ${response.status}`)
      return response.json() as Promise<RentTrendFile>
    })
    // a failed load shouldn't stick
    pending.catch(() => {
      if (request === pending) request = null
    })
    request = pending
  }
  return request
}

const growth = (series: Series) => {
  const first = series[0]
  const last = series[series.length - 1]
  return first && last ? ((last - first) / first) * 100 : null
}

// rent_2br_flat -> 2br_flat. a series needs both ends to give a five-year change
export function rentTrendFor(
  file: RentTrendFile,
  suburbId: string,
  rentMetric: string,
): RentTrend | null {
  const suburb = file.suburbs[suburbId]
  if (!suburb) return null
  const wanted = rentMetric.replace(/^rent_/, '')
  for (const key of [wanted, 'all']) {
    const rents = suburb.rents[key]
    const melbourne = file.melbourne[key]
    if (!rents || !melbourne) continue
    const change = growth(rents)
    const melbourneChange = growth(melbourne)
    if (change === null || melbourneChange === null) continue
    return {
      area: suburb.area,
      ownHome: key === wanted,
      periods: file.periods,
      rents,
      melbourne,
      change,
      melbourneChange,
    }
  }
  return null
}

// the average rise a week each year, in whole dollars. quarters, so four a year
export function yearlyChange(trend: RentTrend) {
  const first = trend.rents[0]!
  const last = trend.rents[trend.rents.length - 1]!
  const years = (trend.periods.length - 1) / 4
  return Math.round((last - first) / years)
}

export function comparedWithMelbourne(trend: RentTrend): 'faster' | 'slower' | 'same' {
  const gap = trend.change - trend.melbourneChange
  if (Math.abs(gap) < SAME_AS_MELBOURNE) return 'same'
  return gap > 0 ? 'faster' : 'slower'
}

// the area is the suburb's own name unless the report groups it with others,
// like Collingwood-Abbotsford for Abbotsford. it writes East Brunswick for
// Brunswick East, so word order doesn't count
export function sharesArea(area: string, suburbName: string) {
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .split(/[^a-z]+/)
      .filter(Boolean)
      .sort()
      .join(' ')
  return words(area) !== words(suburbName)
}
