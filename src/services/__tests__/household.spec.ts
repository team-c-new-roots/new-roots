import { describe, expect, it } from 'vitest'
import { medianFor, suggestBedrooms } from '../household'

describe('suggestBedrooms', () => {
  it('suggests 4 bedrooms for 2 adults and 5 children, like the wireframe', () => {
    expect(suggestBedrooms(2, 5)).toBe(4)
  })

  it('gives a single adult one bedroom', () => {
    expect(suggestBedrooms(1, 0)).toBe(1)
  })

  it('stops at 5, which the chips show as 5+', () => {
    expect(suggestBedrooms(4, 8)).toBe(5)
  })
})

describe('medianFor', () => {
  const rents = { flat1: 340, flat2: 400, house2: 430, house3: 470, house4: 540 }

  it('picks the figure for the home type asked for', () => {
    expect(medianFor(rents, 4, 'house')).toEqual({
      median: 540,
      home: { type: 'house', bedrooms: 4 },
    })
    expect(medianFor(rents, 2, 'flat')?.median).toBe(400)
  })

  it('takes the cheaper of flat and house for either', () => {
    expect(medianFor(rents, 2, 'either')?.home).toEqual({ type: 'flat', bedrooms: 2 })
  })

  it('uses the 4 bed house figure for 5 or more bedrooms', () => {
    expect(medianFor(rents, 5, 'house')?.median).toBe(540)
  })

  it('has nothing for a flat bigger than the report covers', () => {
    expect(medianFor(rents, 4, 'flat')).toBeNull()
  })

  it('returns nothing when a suburb has no rent data', () => {
    expect(medianFor(null, 2, 'either')).toBeNull()
  })
})
