import type { HomeLabel, HomeType } from '@/types'
import type { ScoreRequest } from '@/types/api'
import { PUBLISHED_RENTS } from '@/data/metrics'

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

// why the rent figures describe a different home from the one asked for (US 2.1)
export type HomeNote = 'none' | 'houseOneBed' | 'flatLarge' | 'fivePlus'

export interface HomeRequest {
  request: Pick<ScoreRequest, 'bedrooms' | 'dwelling_type'>
  // the home the household asked for
  asked: HomeLabel
  // the home the rent figures actually describe
  figures: HomeLabel
  note: HomeNote
  // the obt rent column for that home, for "does well" and the details page
  rentMetric: string
}

/* fits the home someone asked for to what the rental report publishes:
   flats with 1 or 2 bedrooms, houses with 2 to 4. anything else moves to the
   closest published size, and the note says so */
export function homeRequest(bedrooms: number, homeType: HomeType): HomeRequest {
  const fivePlus = bedrooms >= 5
  let beds = Math.min(bedrooms, 4)
  let note: HomeNote = fivePlus ? 'fivePlus' : 'none'

  if (homeType === 'house' && beds < PUBLISHED_RENTS.house[0]) {
    beds = PUBLISHED_RENTS.house[0]
    note = 'houseOneBed'
  }

  const largestFlat = PUBLISHED_RENTS.flat[PUBLISHED_RENTS.flat.length - 1]!
  if (homeType === 'flat' && beds > largestFlat) {
    beds = largestFlat
    note = 'flatLarge'
  }

  // "either" with 3 or more bedrooms only has houses to go on, which is fine,
  // the label still says home rather than house
  const dwelling = homeType === 'either' ? 'both' : homeType
  const rentType =
    homeType === 'flat' || (homeType === 'either' && beds <= largestFlat) ? 'flat' : 'house'

  return {
    request: { bedrooms: beds, dwelling_type: dwelling },
    asked: { type: homeType, bedrooms },
    figures: { type: homeType, bedrooms: beds },
    note,
    rentMetric: `rent_${beds}br_${rentType}`,
  }
}
