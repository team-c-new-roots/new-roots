import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  comparedWithMelbourne,
  rentTrendFor,
  yearlyChange,
  sharesArea,
  type RentTrendFile,
} from '@/services/rentTrend'

// vitest runs from the repo root
const exported = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/rent-trend.json'), 'utf8'),
) as RentTrendFile
const appData = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/app-data.json'), 'utf8'),
) as {
  suburbs: Record<string, unknown>[]
}

const file: RentTrendFile = {
  periods: ['2021-06-30', '2021-09-30', '2021-12-31'],
  melbourne: { '2br_flat': [400, 410, 440], all: [400, 420, 460] },
  suburbs: {
    a: {
      area: 'Collingwood-Abbotsford',
      rents: { '2br_flat': [500, null, 600], all: [480, 500, 520] },
    },
    b: { area: 'Pakenham', rents: { '2br_flat': [300, 320, null], all: [350, 360, 400] } },
  },
}

describe('rent trend', () => {
  it('works out the five-year change for the area and Melbourne', () => {
    const trend = rentTrendFor(file, 'a', 'rent_2br_flat')!
    expect(trend.ownHome).toBe(true)
    expect(trend.change).toBeCloseTo(20)
    expect(trend.melbourneChange).toBeCloseTo(10)
    expect(comparedWithMelbourne(trend)).toBe('faster')
  })

  it('averages the change into dollars a week each year', () => {
    // 500 to 600 over two quarters is half a year, so $200 a year
    expect(yearlyChange(rentTrendFor(file, 'a', 'rent_2br_flat')!)).toBe(200)
  })

  it('falls back to all homes when the home has no latest figure', () => {
    const trend = rentTrendFor(file, 'b', 'rent_2br_flat')!
    expect(trend.ownHome).toBe(false)
    expect(trend.rents).toEqual([350, 360, 400])
    expect(trend.melbourne).toEqual([400, 420, 460])
  })

  it('has nothing for a suburb the report doesn’t name', () => {
    expect(rentTrendFor(file, 'c', 'rent_2br_flat')).toBeNull()
  })

  it('calls a change within a few points about the same', () => {
    const trend = { ...rentTrendFor(file, 'a', 'rent_2br_flat')!, change: 11.5 }
    expect(comparedWithMelbourne(trend)).toBe('same')
    expect(comparedWithMelbourne({ ...trend, change: 2 })).toBe('slower')
  })

  it('only names the area when the report groups suburbs', () => {
    expect(sharesArea('Collingwood-Abbotsford', 'Abbotsford')).toBe(true)
    expect(sharesArea('Armadale', 'Armadale (Vic.)')).toBe(false)
    expect(sharesArea('East Brunswick', 'Brunswick East')).toBe(false)
  })

  it('gives every suburb in the export a five-year line', () => {
    const ids = Object.keys(exported.suburbs)
    expect(ids.length).toBeGreaterThan(150)
    expect(exported.periods).toHaveLength(21)
    const missing = ids.filter((id) => rentTrendFor(exported, id, 'rent_2br_flat') === null)
    expect(missing).toEqual([])
  })

  it('ends on the same rents the rest of the app shows', () => {
    const byId = new Map(appData.suburbs.map((row) => [String(row.suburb_id), row]))
    const differ: string[] = []
    for (const [id, suburb] of Object.entries(exported.suburbs)) {
      for (const [key, rents] of Object.entries(suburb.rents)) {
        const latest = rents[rents.length - 1]
        if (key === 'all' || latest === null || latest === undefined) continue
        if (byId.get(id)?.[`rent_${key}_value`] !== latest) differ.push(`${id} ${key}`)
      }
    }
    expect(differ).toEqual([])
  })
})
