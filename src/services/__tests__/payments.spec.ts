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
    expect(amounts.length).toBeGreaterThan(20)
    expect(amounts.filter(({ amount }) => !(amount > 0))).toEqual([])
  })

  it('says when the rates started, as a date', () => {
    expect(RATES_FROM).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
