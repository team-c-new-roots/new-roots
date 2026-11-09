import { describe, expect, it } from 'vitest'
import { estimateBudget, parseMoney, roundToTen } from '../budget'
import type { IncomeAnswers } from '@/types'

// sample rates: parenting 1000, jobseeker 800, family tax 200 a child,
// rent assistance 200, all per fortnight
const base: IncomeAnswers = {
  source: null,
  payments: [],
  otherPaymentFortnight: null,
  wageAmount: null,
  wagePeriod: 'week',
  children: 0,
}

describe('estimateBudget', () => {
  it('waits for an income source before giving a number', () => {
    expect(estimateBudget(base)).toBeNull()
  })

  it('needs at least one payment when Centrelink is chosen', () => {
    expect(estimateBudget({ ...base, source: 'payments' })).toBeNull()
  })

  it("gives Mariam's household about $520 a week with rent assistance", () => {
    const budget = estimateBudget({
      ...base,
      source: 'payments',
      payments: ['parenting', 'jobseeker', 'familyTax'],
      children: 5,
    })
    // 2800 a fortnight is 1400 a week. 30% is 420, plus 100 rent assistance
    expect(budget).toEqual({ weekly: 520, incomeWeekly: 1400, rentAssistanceWeekly: 100 })
  })

  it('never adds rent assistance to wage-only income', () => {
    const budget = estimateBudget({ ...base, source: 'work', wageAmount: 700 })
    expect(budget?.weekly).toBe(210)
    expect(budget?.rentAssistanceWeekly).toBe(0)
  })

  it('turns fortnightly and monthly wages into weekly', () => {
    const fortnight = estimateBudget({
      ...base,
      source: 'work',
      wageAmount: 1400,
      wagePeriod: 'fortnight',
    })
    const month = estimateBudget({ ...base, source: 'work', wageAmount: 3033, wagePeriod: 'month' })
    expect(fortnight?.incomeWeekly).toBe(700)
    expect(month?.incomeWeekly).toBe(700)
  })

  it('needs an amount for Other payments', () => {
    const answers: IncomeAnswers = { ...base, source: 'payments', payments: ['other'] }
    expect(estimateBudget(answers)).toBeNull()
    expect(estimateBudget({ ...answers, otherPaymentFortnight: 600 })?.weekly).toBe(190)
  })
})

describe('parseMoney', () => {
  it('accepts what people type', () => {
    expect(parseMoney('$1,250')).toBe(1250)
    expect(parseMoney(' 700.50 ')).toBe(700.5)
  })

  it('rejects anything that is not a positive amount', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('0')).toBeNull()
    expect(parseMoney('-50')).toBeNull()
  })
})

describe('roundToTen', () => {
  it('rounds to the nearest ten dollars', () => {
    expect(roundToTen(517.4)).toBe(520)
    expect(roundToTen(514.9)).toBe(510)
  })
})
