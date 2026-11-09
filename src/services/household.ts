import type { HomeLabel, HomeType, RentKey, Suburb } from '@/types'

export const MAX_ADULTS = 10
export const MAX_CHILDREN = 12
// the bedroom chips stop at 5, shown as 5+
export const MAX_BEDROOMS = 5

// two people to a room, adults paired up and children paired up. a rough take
// on the occupancy standard, and only ever a starting point the person can change
export function suggestBedrooms(adults: number, children: number): number {
  const rooms = Math.ceil(adults / 2) + Math.ceil(children / 2)
  return Math.min(Math.max(rooms, 1), MAX_BEDROOMS)
}

interface Found {
  median: number
  home: HomeLabel
}

function lookup(rents: NonNullable<Suburb['rents']>, type: 'house' | 'flat', bedrooms: number) {
  const key = `${type}${bedrooms}` as RentKey
  const median = rents[key]
  return median === undefined ? null : { median, home: { type, bedrooms } }
}

/* picks the rent figure that matches the home someone needs.
   the report only has 1 to 3 bed flats and 2 to 4 bed houses, so:
   - 5+ bedrooms uses the 4 bed house figure
   - a 1 bed house falls back to the 2 bed house figure
   - "either" takes whichever of flat or house is cheaper */
export function medianFor(
  rents: Suburb['rents'],
  bedrooms: number,
  homeType: HomeType,
): Found | null {
  if (!rents) return null
  const beds = Math.min(bedrooms, 4)

  const flat = beds <= 3 ? lookup(rents, 'flat', beds) : null
  const house = lookup(rents, 'house', Math.max(beds, 2))

  if (homeType === 'flat') return flat
  if (homeType === 'house') return house

  // either: a 1 bed search shouldn't jump to a 2 bed house just because it exists
  const options = [flat, beds >= 2 ? house : null].filter((item): item is Found => item !== null)
  if (options.length === 0) return null
  return options.reduce((cheapest, item) => (item.median < cheapest.median ? item : cheapest))
}
