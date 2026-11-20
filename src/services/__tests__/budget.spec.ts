import { describe, expect, it } from 'vitest'
import type { AdultPayment, IncomeAnswers } from '@/types'
import {
  MONEY_MAX_LENGTH,
  WAGE_MAX,
  budgetParts,
  checkMoney,
  estimateBudget,
  parseMoney,
  roundToTen,
  toWeekly,
} from '../budget'

// a household with nothing answered, each test fills in what it needs
const blank: IncomeAnswers = {
  source: null,
  incomes: [{ payment: null, otherFortnight: null }],
  familyTax: null,
  wageAmount: null,
  wagePeriod: 'week',
  adults: 1,
  children: 0,
  couple: null,
  teens: 0,
  youngestUnderFive: null,
}

// one row per adult, in order. a number is another payment's fortnightly amount
function adults(...rows: (AdultPayment | number)[]): Pick<IncomeAnswers, 'incomes' | 'adults'> {
  return {
    adults: rows.length,
    incomes: rows.map((row) =>
      typeof row === 'number'
        ? { payment: 'other', otherFortnight: row }
        : { payment: row, otherFortnight: null },
    ),
  }
}

// each payment's weekly rate with its energy supplement
const JOBSEEKER = 416.85 + 4.4
const JOBSEEKER_PARTNERED = 381.5 + 3.95
const RENT_ASSISTANCE = 111.9
const RENT_ASSISTANCE_COUPLE = 105.5

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
    const budget = estimateBudget({ ...blank, source: 'payments', ...adults('jobseeker') })
    expect(budget?.incomeWeekly).toBe(533.15)
    expect(budget?.rentAssistanceWeekly).toBe(RENT_ASSISTANCE)
    expect(budget?.weekly).toBe(160)
  })

  it('waits for the couple question and for every adult’s answer', () => {
    const answers: IncomeAnswers = { ...blank, source: 'payments', ...adults('jobseeker', 'none') }
    expect(estimateBudget(answers)).toBeNull()
    expect(estimateBudget({ ...answers, couple: 'yes' })?.incomeWeekly).toBe(
      JOBSEEKER_PARTNERED + RENT_ASSISTANCE_COUPLE,
    )
    const unanswered = { ...answers, couple: 'yes' as const, incomes: answers.incomes.slice(0, 1) }
    expect(estimateBudget(unanswered)).toBeNull()
  })

  it('counts both adults in a couple on JobSeeker, $260 a week rather than $150', () => {
    const couple: IncomeAnswers = { ...blank, source: 'payments', couple: 'yes' }
    expect(estimateBudget({ ...couple, ...adults('jobseeker', 'none') })?.weekly).toBe(150)
    const both = estimateBudget({ ...couple, ...adults('jobseeker', 'jobseeker') })
    expect(both?.incomeWeekly).toBe(2 * JOBSEEKER_PARTNERED + RENT_ASSISTANCE_COUPLE)
    expect(both?.weekly).toBe(260)
  })

  it('gives two adults who aren’t a couple a single rate each', () => {
    const budget = estimateBudget({
      ...blank,
      source: 'payments',
      couple: 'no',
      ...adults('jobseeker', 'jobseeker'),
    })
    // 2 x 421.25 + 111.90 single rent assistance = 954.40, 30% is $286
    expect(budget?.incomeWeekly).toBe(954.4)
    expect(budget?.weekly).toBe(290)
  })

  it('adds up another payment for each adult who gets one, like Youth Allowance', () => {
    const budget = estimateBudget({
      ...blank,
      source: 'payments',
      couple: 'no',
      ...adults(700, 640),
    })
    // 350 + 320 a week, plus single rent assistance
    expect(budget?.incomeWeekly).toBe(350 + 320 + RENT_ASSISTANCE)
  })

  it('mixes payments, with a grown-up child on JobSeeker at the single rate', () => {
    const budget = estimateBudget({
      ...blank,
      source: 'payments',
      couple: 'yes',
      ...adults('jobseeker', 'none', 'jobseeker'),
    })
    expect(budget?.incomeWeekly).toBe(JOBSEEKER_PARTNERED + JOBSEEKER + RENT_ASSISTANCE_COUPLE)
  })

  it('works out a large family on payments (Mariam)', () => {
    const budget = estimateBudget({
      ...blank,
      source: 'payments',
      ...adults('parenting', 'jobseeker'),
      children: 5,
      couple: 'yes',
      familyTax: 'yes',
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

  it('waits for the Family Tax Benefit answer when there are children', () => {
    const answers: IncomeAnswers = {
      ...blank,
      source: 'payments',
      ...adults('jobseeker'),
      children: 1,
    }
    expect(estimateBudget(answers)).toBeNull()
    // a single parent on JobSeeker gets the with-children rate
    expect(estimateBudget({ ...answers, familyTax: 'no' })?.incomeWeekly).toBe(
      446.4 + 4.75 + RENT_ASSISTANCE,
    )
  })

  it('never counts Parenting Payment without children, or for both people in a couple', () => {
    const noChildren = { ...blank, source: 'payments' as const, ...adults('parenting') }
    expect(estimateBudget(noChildren)).toBeNull()
    const bothParents: IncomeAnswers = {
      ...blank,
      source: 'payments',
      couple: 'yes',
      children: 2,
      familyTax: 'no',
      ...adults('parenting', 'parenting'),
    }
    expect(estimateBudget(bothParents)).toBeNull()
  })

  it('needs at least one payment, and an amount for another payment', () => {
    const answers = { ...blank, source: 'payments' as const, ...adults('none') }
    expect(estimateBudget(answers)).toBeNull()
    const noAmount: IncomeAnswers = {
      ...blank,
      source: 'payments',
      adults: 1,
      incomes: [{ payment: 'other', otherFortnight: null }],
    }
    expect(estimateBudget(noAmount)).toBeNull()
    expect(estimateBudget({ ...blank, source: 'payments', ...adults(600) })?.incomeWeekly).toBe(
      300 + RENT_ASSISTANCE,
    )
  })

  it('adds a wage on top of payments when the household has both', () => {
    const payments = estimateBudget({ ...blank, source: 'payments', ...adults('jobseeker') })!
    const both = estimateBudget({
      ...blank,
      source: 'both',
      ...adults('jobseeker'),
      wageAmount: 400,
      wagePeriod: 'fortnight',
    })!
    expect(both.incomeWeekly).toBeCloseTo(payments.incomeWeekly + 200, 2)
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

// teacher feedback: say what's wrong with a money field, not just "enter dollars"
describe('checkMoney', () => {
  it('takes dollar signs, commas, spaces and cents', () => {
    expect(checkMoney('$1,250')).toEqual({ value: 1250, problem: null })
    expect(checkMoney(' 650.50 ')).toEqual({ value: 650.5, problem: null })
    expect(checkMoney('.5')).toEqual({ value: 0.5, problem: null })
  })

  it('names each kind of mistake', () => {
    expect(checkMoney('').problem).toBe('empty')
    expect(checkMoney('-500').problem).toBe('negative')
    expect(checkMoney('\u2212500').problem).toBe('negative')
    expect(checkMoney('5o0').problem).toBe('notNumber')
    expect(checkMoney('500#').problem).toBe('notNumber')
    expect(checkMoney('1.2.3').problem).toBe('notNumber')
    expect(checkMoney('650.555').problem).toBe('decimals')
    expect(checkMoney('0').problem).toBe('zero')
    expect(checkMoney('0.00').problem).toBe('zero')
  })

  it('stops at the top amount for each pay period', () => {
    expect(checkMoney('10000', WAGE_MAX.week).problem).toBeNull()
    expect(checkMoney('10000.01', WAGE_MAX.week).problem).toBe('tooBig')
    expect(checkMoney('40000', WAGE_MAX.month).problem).toBeNull()
    expect(checkMoney('00000000000000000000', WAGE_MAX.week).problem).toBe('zero')
  })

  it('lets the longest allowed amount fit in the field', () => {
    expect('$40,000.00'.length).toBeLessThanOrEqual(MONEY_MAX_LENGTH)
  })
})

// US 1.1, "how we worked this out" shows the same sum line by line
describe('budgetParts', () => {
  it('adds up to the income the budget is worked out from', () => {
    const households: IncomeAnswers[] = [
      { ...blank, source: 'work', wageAmount: 1300, wagePeriod: 'fortnight' },
      { ...blank, source: 'payments', ...adults('jobseeker') },
      {
        ...blank,
        source: 'both',
        ...adults('parenting', 'jobseeker'),
        couple: 'yes',
        children: 5,
        teens: 2,
        familyTax: 'yes',
        youngestUnderFive: 'yes',
        wageAmount: 400,
      },
      { ...blank, source: 'payments', ...adults(900), wagePeriod: 'month' },
    ]
    for (const household of households) {
      const parts = budgetParts(household)!
      const total = parts.reduce((sum, part) => sum + part.weekly, 0)
      expect(Math.round(total * 100) / 100).toBe(estimateBudget(household)!.incomeWeekly)
    }
  })

  it('lists rent assistance on its own line, and none for a wage alone', () => {
    const payments = budgetParts({ ...blank, source: 'payments', ...adults('jobseeker') })!
    expect(payments.map((part) => part.kind)).toEqual(['payment', 'rentAssistance'])
    const wage = budgetParts({ ...blank, source: 'work', wageAmount: 700 })!
    expect(wage).toEqual([{ kind: 'wage', weekly: 700, amount: 700, period: 'week' }])
  })

  it('says which adult gets which payment', () => {
    const parts = budgetParts({
      ...blank,
      source: 'payments',
      ...adults('none', 'jobseeker'),
      couple: 'no',
    })!
    expect(parts[0]).toMatchObject({ kind: 'payment', adult: 2, payment: 'jobseeker' })
  })

  it('waits for answers like the budget does', () => {
    expect(budgetParts(blank)).toBeNull()
    expect(budgetParts({ ...blank, source: 'work' })).toBeNull()
  })
})
