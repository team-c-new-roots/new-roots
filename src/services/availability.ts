/* US 2.5, how often homes like theirs come up for rent. from
   scripts/export_availability in export_app_data.py: new leases in the year
   to the rental report's latest quarter, for each home size, and the share
   of each council's new leases that were affordable on Centrelink incomes.
   a small file of its own, so the suburb data doesn't grow for everyone */

// where a suburb's figure comes from: itself, the rental report area it
// shares with a neighbour or two, or its whole council
export type AvailabilityLevel = 's' | 'p' | 'c'

// count, level, area (-1 for the suburb itself), suburbs sharing the figure,
// band (-1 fewer than most, 0 about the same, 1 more) and few (1 or 0)
type AvailabilityRow = [number, AvailabilityLevel, number, number, -1 | 0 | 1, 0 | 1]

export interface AvailabilityFile {
  period: string
  areas: string[]
  homes: Record<string, Record<string, AvailabilityRow>>
  councils: Record<string, number>
  // council name, then bedrooms (4 is 4 or more), then [count, share %]
  affordable: Record<string, Record<string, [number, number]>>
}

export interface Availability {
  count: number
  level: AvailabilityLevel
  // the report area's suburbs, or the council's name
  area: string | null
  shared: number
  band: 'fewer' | 'about' | 'more'
  few: boolean
}

export interface Affordable {
  council: string
  count: number
  share: number
}

const BANDS = { '-1': 'fewer', '0': 'about', '1': 'more' } as const

let request: Promise<AvailabilityFile> | null = null

export function loadAvailability(): Promise<AvailabilityFile> {
  if (!request) {
    request = fetch(`${import.meta.env.BASE_URL}data/availability.json`).then((response) => {
      if (!response.ok) throw new Error(`availability ${response.status}`)
      return response.json() as Promise<AvailabilityFile>
    })
    // a failed load shouldn't stick
    request.catch(() => {
      request = null
    })
  }
  return request
}

// rent_2br_flat or 2br_flat, the same home the rent figures describe
export function availabilityFor(
  file: AvailabilityFile,
  suburbId: string,
  home: string,
): Availability | null {
  const row = file.homes[home.replace(/^rent_/, '')]?.[suburbId]
  if (!row) return null
  const [count, level, area, shared, band, few] = row
  return {
    count,
    level,
    area: area >= 0 ? (file.areas[area] ?? null) : null,
    shared,
    band: BANDS[String(band) as keyof typeof BANDS],
    few: few === 1,
  }
}

// "Collingwood-Abbotsford" is how the rental report names an area it
// reports as one
export function areaSuburbs(area: string): string[] {
  return area
    .split('-')
    .map((name) => name.trim())
    .filter(Boolean)
}

// the council's figure for that many bedrooms, 4 standing for 4 or more
export function affordableFor(
  file: AvailabilityFile,
  suburbId: string,
  bedrooms: number,
): Affordable | null {
  const index = file.councils[suburbId]
  const council = index === undefined ? undefined : file.areas[index]
  if (!council) return null
  const row = file.affordable[council]?.[String(Math.min(Math.max(bedrooms, 1), 4))]
  if (!row) return null
  return { council, count: row[0], share: row[1] }
}
