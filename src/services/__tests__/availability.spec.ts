import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  affordableFor,
  areaSuburbs,
  availabilityFor,
  rentHomeOf,
  type AvailabilityFile,
} from '../availability'
import type { AppData } from '@/types/scoring'

// US 2.5, checked against the exported file the app loads
const file: AvailabilityFile = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/availability.json'), 'utf8'),
)
const app: AppData = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/app-data.json'), 'utf8'),
)
const HOMES = ['1br_flat', '2br_flat', '3br_flat', '2br_house', '3br_house', '4br_house']

describe('how often homes come up', () => {
  it('has a date to show with the source', () => {
    expect(file.period).toMatch(/^[A-Z][a-z]+ \d{4}$/)
  })

  it('never gives a count of zero, a missing figure is left out instead', () => {
    for (const home of HOMES) {
      for (const row of Object.values(file.homes[home]!)) expect(row[0]).toBeGreaterThan(0)
    }
  })

  it('says where every figure comes from, and names the area or council when it is shared', () => {
    for (const home of HOMES) {
      for (const [id] of Object.entries(file.homes[home]!)) {
        const found = availabilityFor(file, id, home)!
        expect(['s', 'p', 'c']).toContain(found.level)
        // its own figure, or a named area or council shared by more than one
        expect(found.level === 's' ? found.shared === 1 : Boolean(found.area)).toBe(true)
      }
    }
  })

  it('covers every suburb for the most common home sizes', () => {
    for (const home of ['2br_flat', '3br_house']) {
      for (const suburb of app.suburbs) {
        expect(availabilityFor(file, suburb.suburb_id, home)).not.toBeNull()
      }
    }
  })

  it('reads the rent column name the same as the home size', () => {
    const id = Object.keys(file.homes['2br_flat']!)[0]!
    expect(availabilityFor(file, id, 'rent_2br_flat')).toEqual(
      availabilityFor(file, id, '2br_flat'),
    )
  })

  it('flags only the suburbs that also count as fewer than most', () => {
    for (const home of HOMES) {
      const rows = Object.keys(file.homes[home]!).map((id) => availabilityFor(file, id, home)!)
      const flagged = rows.filter((row) => row.few)
      expect(flagged.length).toBeGreaterThan(0)
      expect(flagged.length).toBeLessThan(rows.length * 0.25)
      for (const row of flagged) expect(row.band).toBe('fewer')
    }
  })

  it('splits a report area into its suburbs', () => {
    expect(areaSuburbs('Albert Park-Middle Park-West St Kilda')).toEqual([
      'Albert Park',
      'Middle Park',
      'West St Kilda',
    ])
  })

  it('finds a council share of affordable new leases for every suburb', () => {
    for (const suburb of app.suburbs) {
      const row = affordableFor(file, suburb.suburb_id, 2)
      expect(row).not.toBeNull()
      expect(row!.share).toBeGreaterThanOrEqual(0)
      expect(row!.share).toBeLessThanOrEqual(100)
    }
  })

  it('uses the 4 or more bedroom figure for big homes, and the full council names', () => {
    const id = app.suburbs[0]!.suburb_id
    expect(affordableFor(file, id, 5)).toEqual(affordableFor(file, id, 4))
    expect(file.areas).not.toContain('Mornington Penin’a')
    expect(file.areas.some((name) => name.includes("Penin'a"))).toBe(false)
  })

  it('uses the same home as the rent figure, so Either never adds flats and houses together', () => {
    expect(rentHomeOf('flat', { type: 'either', bedrooms: 2 }, 'rent_2br_house')).toBe(
      'rent_2br_flat',
    )
    expect(rentHomeOf('house', { type: 'either', bedrooms: 3 }, 'rent_3br_flat')).toBe(
      'rent_3br_house',
    )
    expect(rentHomeOf(null, { type: 'house', bedrooms: 3 }, 'rent_3br_house')).toBe(
      'rent_3br_house',
    )
  })
})
