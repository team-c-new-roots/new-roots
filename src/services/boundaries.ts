import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export interface BoundaryProperties {
  id: string
  name: string
}

export type Boundaries = FeatureCollection<Polygon | MultiPolygon, BoundaryProperties>

// sample shapes for now, generated from rough suburb centres. the data team
// replaces this file with simplified ABS suburb boundaries. it's a static file
// rather than part of the bundle so the map is the only screen that pays for it
const SOURCE = `${import.meta.env.BASE_URL}data/sample-boundaries.geojson`

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
