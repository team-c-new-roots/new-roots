import { describe, expect, it } from 'vitest'
import type { AppData } from '@/types/scoring'
import { travelScores, tripFrom, withTravel, type TravelFile } from '../travel'

const file: TravelFile = { t: { a: 0, b: 20, c: 60 }, walk: { d: 35 } }

// US 4.2
describe('travel times', () => {
  it('reads each kind of trip from a destination file', () => {
    expect(tripFrom(file, 'a')).toEqual({ kind: 'same', minutes: 0 })
    expect(tripFrom(file, 'b')).toEqual({ kind: 'transit', minutes: 20 })
    expect(tripFrom(file, 'd')).toEqual({ kind: 'walk', minutes: 35 })
    expect(tripFrom(file, 'e')).toEqual({ kind: 'none', minutes: null })
  })

  it('scores shorter trips higher and no way there as 0', () => {
    const scores = travelScores([10, 20, 30, 40, 50, null])
    expect(scores[0]).toBe(100)
    expect(scores[4]).toBe(0)
    expect(scores[1]! > scores[3]!).toBe(true)
    expect(scores[5]).toBe(0)
  })

  it('adds a Commute topic split evenly between the places', () => {
    const data = {
      weights: [],
      suburbs: ['a', 'b', 'c', 'd', 'e'].map((id) => ({
        suburb_id: id,
        suburb_name: id,
        suburb_area_km2: 1,
      })),
    } as unknown as AppData
    const out = withTravel(data, [
      { id: 'x', file },
      { id: 'y', file },
    ])
    expect(out.weights.map((row) => [row.topic, row.metric, row.weight])).toEqual([
      ['Commute', 'travel_time_1', 50],
      ['Commute', 'travel_time_2', 50],
    ])
    expect(out.suburbs[1]!.travel_time_1_value).toBe(20)
    expect(out.suburbs[4]!.travel_time_1_score).toBe(0)
    // the original isn't touched
    expect(data.suburbs[1]!.travel_time_1_value).toBeUndefined()
  })
})
