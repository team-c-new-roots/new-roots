import { describe, expect, it } from 'vitest'
import { homeRequest, suggestBedrooms } from '../household'

describe('suggestBedrooms', () => {
  it('pairs adults and children up, two to a room', () => {
    expect(suggestBedrooms(1, 0)).toBe(1)
    expect(suggestBedrooms(2, 5)).toBe(4)
    expect(suggestBedrooms(2, 9)).toBe(5)
  })
})

describe('homeRequest', () => {
  it('passes a home the rental report publishes straight through', () => {
    const home = homeRequest(2, 'flat')
    expect(home.request).toEqual({ bedrooms: 2, dwelling_type: 'flat' })
    expect(home.note).toBe('none')
    expect(home.rentMetric).toBe('rent_2br_flat')
  })

  it('moves a 1-bed house to the 2-bed figures and says so (US 2.1)', () => {
    const home = homeRequest(1, 'house')
    expect(home.request.bedrooms).toBe(2)
    expect(home.figures).toEqual({ type: 'house', bedrooms: 2 })
    expect(home.note).toBe('houseOneBed')
  })

  it('caps flats at 2 bedrooms, the largest the data covers', () => {
    const home = homeRequest(4, 'flat')
    expect(home.request).toEqual({ bedrooms: 2, dwelling_type: 'flat' })
    expect(home.note).toBe('flatLarge')
  })

  it('uses the 4-bed figures for 5 or more and notes bigger homes cost more', () => {
    const home = homeRequest(5, 'either')
    expect(home.request).toEqual({ bedrooms: 4, dwelling_type: 'both' })
    expect(home.asked.bedrooms).toBe(5)
    expect(home.note).toBe('fivePlus')
    expect(home.rentMetric).toBe('rent_4br_house')
  })
})
