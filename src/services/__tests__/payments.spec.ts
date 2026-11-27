import { describe, expect, it } from 'vitest'
import { RATES, RATES_FROM } from '@/data/centrelink-rates'

// src/data/payments.json comes from the data team's table, so check the export
// gave the budget everything it reads before anyone sees a $0 payment
describe('exported payment rates', () => {
  it('has a positive weekly amount for every rate the budget uses', () => {
    const amounts = Object.entries(RATES).flatMap(([group, figures]) =>
      Object.entries(figures as Record<string, number>).map(([name, amount]) => ({
        rate: `${group}.${name}`,
        amount,
      })),
    )
    // 2 parenting, 3 jobseeker, 4 FTB and 4 FTB supplements, 6 rent assistance
    expect(amounts.length).toBe(19)
    expect(amounts.filter(({ amount }) => !(amount > 0))).toEqual([])
  })

  // JobSeeker and Parenting Payment are the typical total rate, which already
  // has the Energy Supplement in it, so there's no separate one to add (US 1.1)
  it('has no separate Energy Supplement for JobSeeker or Parenting Payment', () => {
    expect(Object.keys(RATES)).not.toContain('jobseekerEnergy')
    expect(Object.keys(RATES)).not.toContain('parentingEnergy')
    expect(RATES.jobseeker.partnered).toBe(381.5)
    expect(RATES.parenting.partnered).toBe(381.5)
  })

  it('says when the rates started, as a date', () => {
    expect(RATES_FROM).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
