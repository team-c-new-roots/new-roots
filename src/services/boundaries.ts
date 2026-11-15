import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export interface BoundaryProperties {
  suburb_id: string
  suburb_name: string
  // where a suburb's score label sits, worked out by the data team
  label_lat: number
  label_lon: number
}

export type Boundaries = FeatureCollection<Polygon | MultiPolygon, BoundaryProperties>

/* ABS suburb shapes from the data team, simplified together so neighbouring
   borders still meet. a static file rather than part of the bundle, so only
   the map pays for it, and it's the same for everyone so it caches */
const SOURCE = `${import.meta.env.BASE_URL}data/suburbs.geojson`

let cached: Promise<Boundaries> | null = null

export function loadBoundaries(): Promise<Boundaries> {
  if (!cached) {
    cached = fetch(SOURCE).then((response) => {
      if (!response.ok) throw new Error(`boundaries ${response.status}`)
      return response.json() as Promise<Boundaries>
    })
    // a failed load shouldn't stick, let the next visit to the map try again
    cached.catch(() => {
      cached = null
    })
  }
  return cached
}
