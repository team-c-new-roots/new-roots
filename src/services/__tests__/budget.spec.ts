import { describe, expect, it } from 'vitest'
import type { IncomeAnswers } from '@/types'
import { estimateBudget, parseMoney, roundToTen, toWeekly } from '../budget'

// a household with nothing answered, each test fills in what it needs
const blank: IncomeAnswers = {
  source: null,
  payments: [],
  otherPaymentFortnight: null,
  wageAmount: null,
  wagePeriod: 'week',
  adults: 1,
  children: 0,
  couple: null,
  teens: 0,
  youngestUnderFive: null,
}

describe('estimateBudget', () => {
  it('waits for an answer instead of showing $0', () => {
    expect(estimateBudget(blank)).toBeNull()
    expect(estimateBudget({ ...blank, source: 'payments' })).toBeNull()
    expect(estimateBudget({ ...blank, source: 'work' })).toBeNull()
  })

  it('takes 30% of a wage and leaves out rent assistance (Reza)', () => {
    const budget = estimateBudget({ ...blank, source: 'work', wageAmount: 700 })
    expect(budget).toEqual({ weekly: 210, incomeWeekly: 700, rentAssistanceWeekly: 0 })
  })

  it('counts rent assistance and energy supplements as income for a single job seeker', () => {
    // 416.85 jobseeker + 4.40 energy + 111.90 rent assistance = 533.15
    const budget = estimateBudget({ ...blank, source: 'payments', payments: ['jobseeker'] })
    expect(budget?.incomeWeekly).toBe(533.15)
    expect(budget?.rentAssistanceWeekly).toBe(111.9)
    expect(budget?.weekly).toBe(160)
  })

  it('waits for the couple question when there is more than one adult', () => {
    const answers: IncomeAnswers = {
      ...blank,
      adults: 2,
      source: 'payments',
      payments: ['jobseeker'],
    }
    expect(estimateBudget(answers)).toBeNull()
    expect(estimateBudget({ ...answers, couple: 'yes' })?.incomeWeekly).toBe(
      // partnered rate, partnered energy supplement, couple rent assistance
      381.5 + 3.95 + 105.5,
    )
  })

  it('works out a large family on payments (Mariam)', () => {
    const budget = estimateBudget({
      ...blank,
      source: 'payments',
      payments: ['parenting', 'jobseeker', 'familyTax'],
      adults: 2,
      children: 5,
      couple: 'yes',
      teens: 1,
      youngestUnderFive: 'yes',
    })
    // parenting and jobseeker at partnered rates with their supplements,
    // FTB A for four under 13 and one teen, FTB B for an under 5,
    // rent assistance for a family with 3 or more children
    expect(budget?.incomeWeekly).toBe(1654.58)
    expect(budget?.rentAssistanceWeekly).toBe(148.68)
    expect(budget?.weekly).toBe(500)
  })

  it('adds a wage on top of payments when the household has both', () => {
    const payments = estimateBudget({ ...blank, source: 'payments', payments: ['jobseeker'] })!
    const both = estimateBudget({
      ...blank,
      source: 'both',
      payments: ['jobseeker'],
      wageAmount: 400,
      wagePeriod: 'fortnight',
    })!
    expect(both.incomeWeekly).toBeCloseTo(payments.incomeWeekly + 200, 2)
  })

  it('needs an amount when other payments are ticked', () => {
    const answers: IncomeAnswers = { ...blank, source: 'payments', payments: ['other'] }
    expect(estimateBudget(answers)).toBeNull()
    expect(estimateBudget({ ...answers, otherPaymentFortnight: 600 })?.incomeWeekly).toBe(
      300 + 111.9,
    )
  })
})

describe('helpers', () => {
  it('rounds to the nearest $10', () => {
    expect(roundToTen(496.37)).toBe(500)
    expect(roundToTen(214)).toBe(210)
  })

  it('turns any pay period into a week', () => {
    expect(toWeekly(1000, 'fortnight')).toBe(500)
    expect(toWeekly(5200, 'month')).toBeCloseTo(1200, 5)
  })

  it('reads money the way people type it', () => {
    expect(parseMoney('$1,250')).toBe(1250)
    expect(parseMoney('80.50')).toBe(80.5)
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('0')).toBeNull()
  })
})
