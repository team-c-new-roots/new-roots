import { describe, expect, it } from 'vitest'
import { monthlyRent, moveInCost } from '@/services/moveIn'
import { MOVE_IN } from '@/data/move-in'

describe('move-in cost', () => {
  it('turns weekly rent into a calendar month like CAV does', () => {
    // CAV's worked example, $500 a week is $2,172.62 a month
    expect(monthlyRent(500)).toBeCloseTo(2172.62, 2)
  })

  it('adds a month of bond to a month of rent in advance', () => {
    const cost = moveInCost(480)
    expect(cost.bond).toBe(2086)
    expect(cost.advance).toBe(2086)
    expect(cost.total).toBe(4172)
  })

  it('rounds to the dollar and the parts add up to the total', () => {
    for (const weekly of [212, 355, 517, 640, 899]) {
      const cost = moveInCost(weekly)
      expect(Number.isInteger(cost.bond)).toBe(true)
      expect(cost.bond + cost.advance).toBe(cost.total)
    }
  })

  it('only claims the one month limits up to $900 a week', () => {
    expect(moveInCost(900).limited).toBe(true)
    expect(moveInCost(901).limited).toBe(false)
  })

  it('links bond loans to the same page as the support list', () => {
    expect(MOVE_IN.bondLoanUrl).toMatch(/homes-victoria-bond-loans$/)
  })
})
