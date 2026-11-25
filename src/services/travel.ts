import type { AppData, ObtRow } from '@/types/scoring'

/* public transport travel times between suburbs (US 4.2), from
   scripts/export_travel_times.py. the data team worked them out from the
   middle of each suburb to the middle of every other, on a Wednesday
   arriving by 8:30 am, so they're a guide for comparing suburbs, not a
   door-to-door trip. one file per destination, loaded only for the places
   someone picks, and kept on the phone like everything else */

export interface TravelFile {
  // minutes by public transport, 0 for the same suburb
  t: Record<string, number>
  // minutes on foot, where walking beats any public transport
  walk: Record<string, number>
}

export type TripKind = 'same' | 'transit' | 'walk' | 'none'

export interface Trip {
  kind: TripKind
  minutes: number | null
}

// up to two places, like a workplace and an English class
export const MAX_PLACES = 2

const files = new Map<string, Promise<TravelFile>>()

export function loadTravel(destination: string): Promise<TravelFile> {
  let request = files.get(destination)
  if (!request) {
    request = fetch(`${import.meta.env.BASE_URL}data/travel/${destination}.json`).then(
      (response) => {
        if (!response.ok) throw new Error(`travel ${response.status}`)
        return response.json() as Promise<TravelFile>
      },
    )
    // a failed load shouldn't stick
    request.catch(() => files.delete(destination))
    files.set(destination, request)
  }
  return request
}

export function tripFrom(file: TravelFile, origin: string): Trip {
  const transit = file.t[origin]
  if (transit === 0) return { kind: 'same', minutes: 0 }
  if (transit !== undefined) return { kind: 'transit', minutes: transit }
  const walk = file.walk[origin]
  if (walk !== undefined) return { kind: 'walk', minutes: walk }
  return { kind: 'none', minutes: null }
}

// the metric for the nth place, travel_time_1 and travel_time_2
export const travelMetric = (index: number) => `travel_time_${index + 1}`

function quantile(sorted: number[], q: number) {
  const at = (sorted.length - 1) * q
  const low = Math.floor(at)
  const high = Math.ceil(at)
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (at - low)
}

/* the same 0 to 100 as the data team's distances: the 10th to 90th
   percentile, shorter is better. no way there by 8:30 scores 0, since
   that's the worst it can be, not a gap in the data */
export function travelScores(minutes: (number | null)[]): number[] {
  const known = minutes.filter((value): value is number => value !== null).sort((a, b) => a - b)
  if (!known.length) return minutes.map(() => 0)
  const low = quantile(known, 0.1)
  const high = quantile(known, 0.9)
  return minutes.map((value) => {
    if (value === null) return 0
    if (high === low) return 100
    const clamped = Math.min(Math.max(value, low), high)
    return Math.round(100 - ((clamped - low) / (high - low)) * 100)
  })
}

/* the app's data with a travel time for each place added to every suburb,
   and a Commute topic in the weights so the scoring counts it. the places
   split the topic's weight evenly */
export function withTravel(data: AppData, places: { id: string; file: TravelFile }[]): AppData {
  if (!places.length) return data
  const suburbs: ObtRow[] = data.suburbs.map((suburb) => ({ ...suburb }))
  places.forEach(({ file }, index) => {
    const metric = travelMetric(index)
    const trips = suburbs.map((suburb) => tripFrom(file, suburb.suburb_id))
    const scores = travelScores(trips.map((trip) => trip.minutes))
    suburbs.forEach((suburb, at) => {
      suburb[`${metric}_value`] = trips[at]!.minutes
      suburb[`${metric}_kind`] = trips[at]!.kind
      suburb[`${metric}_score`] = scores[at]!
    })
  })
  const share = 100 / places.length
  return {
    ...data,
    suburbs,
    weights: [
      ...data.weights,
      ...places.map((_, index) => ({
        topic: 'Commute' as const,
        table: 'obt' as const,
        metric: travelMetric(index),
        weight: share,
      })),
    ],
  }
}
