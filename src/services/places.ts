import { isPlaceType, type PlaceType } from '@/data/places'

export interface Place {
  type: PlaceType
  // Vicmap leaves some unnamed, mostly playgrounds, so those show their type
  name: string | null
  lat: number
  lon: number
}

/* one small file per suburb from scripts/export_places.py, with the places
   inside it and a margin past its border. only fetched once someone opens
   the filters or has some chosen, and kept for the visit */
const cache = new Map<string, Promise<Place[]>>()

export function loadPlaces(suburbId: string): Promise<Place[]> {
  let request = cache.get(suburbId)
  if (!request) {
    request = fetch(`${import.meta.env.BASE_URL}data/places/${encodeURIComponent(suburbId)}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`places ${response.status}`)
        return response.json() as Promise<[string, string | null, number, number][]>
      })
      .then((rows) =>
        rows.flatMap(([type, name, lat, lon]) =>
          isPlaceType(type) ? [{ type, name, lat, lon }] : [],
        ),
      )
    // a failed load shouldn't stick
    request.catch(() => cache.delete(suburbId))
    cache.set(suburbId, request)
  }
  return request
}

// straight line, in km. good enough to sort a list and say roughly how far
export function distanceKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const rad = Math.PI / 180
  const dLat = (to.lat - from.lat) * rad
  const dLon = (to.lon - from.lon) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}
