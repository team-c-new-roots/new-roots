import type { BudgetEstimate, IncomeAnswers, PayPeriod } from '@/types'
import { RATES } from '@/data/centrelink-rates'

// the rental report calls a home affordable when rent is at most 30% of income
export const AFFORDABLE_SHARE = 0.3

const WEEKS_IN: Record<PayPeriod, number> = {
  week: 1,
  fortnight: 2,
  month: 52 / 12,
}

// "about $520" reads better than $517.40 and the inputs aren't that precise anyway
export function roundToTen(value: number): number {
  return Math.round(value / 10) * 10
}

export function toWeekly(amount: number, period: PayPeriod): number {
  return amount / WEEKS_IN[period]
}

function cents(value: number): number {
  return Math.round(value * 100) / 100
}

export function usesPayments(answers: Pick<IncomeAnswers, 'source'>): boolean {
  return answers.source === 'payments' || answers.source === 'both'
}

export function usesWork(answers: Pick<IncomeAnswers, 'source'>): boolean {
  return answers.source === 'work' || answers.source === 'both'
}

// the couple question only shows when there's more than one adult
export function needsCoupleAnswer(answers: IncomeAnswers): boolean {
  return usesPayments(answers) && answers.adults > 1
}

/* payments plus their energy supplements and rent assistance, at maximum
   rates. rent assistance counts as income, the way the scoring module and the
   rental report's affordability measure treat it, then the budget is 30% of
   the lot. returns null while an answer it needs is missing */
function weeklyPayments(answers: IncomeAnswers): { amount: number; rentAssistance: number } | null {
  if (answers.payments.length === 0) return null
  if (needsCoupleAnswer(answers) && answers.couple === null) return null

  const couple = answers.adults > 1 && answers.couple === 'yes'
  const hasChildren = answers.children > 0
  let amount = 0

  if (answers.payments.includes('parenting')) {
    amount += couple ? RATES.parenting.partnered : RATES.parenting.single
    amount += couple ? RATES.parentingEnergy.partnered : RATES.parentingEnergy.single
  }

  if (answers.payments.includes('jobseeker')) {
    const situation = couple ? 'partnered' : hasChildren ? 'singleWithChildren' : 'singleNoChildren'
    amount += RATES.jobseeker[situation] + RATES.jobseekerEnergy[situation]
  }

  const familyTax = answers.payments.includes('familyTax') && hasChildren
  if (familyTax) {
    const teens = Math.min(answers.teens, answers.children)
    const younger = answers.children - teens
    amount += younger * (RATES.ftbA.child0to12 + RATES.ftbAEnergy.child0to12)
    amount += teens * (RATES.ftbA.child13to19 + RATES.ftbAEnergy.child13to19)
    // until they say, assume the youngest is 5 or older, the lower rate
    const underFive = answers.youngestUnderFive === 'yes'
    amount += underFive ? RATES.ftbB.youngestUnder5 : RATES.ftbB.youngest5to18
    amount += underFive ? RATES.ftbBEnergy.youngestUnder5 : RATES.ftbBEnergy.youngest5to18
  }

  if (answers.payments.includes('other')) {
    if (!answers.otherPaymentFortnight || answers.otherPaymentFortnight <= 0) return null
    amount += toWeekly(answers.otherPaymentFortnight, 'fortnight')
  }

  const ra = RATES.rentAssistance
  const rentAssistance = familyTax
    ? answers.children >= 3
      ? ra.withFtb3plus
      : ra.withFtb1to2
    : couple
      ? ra.couple
      : ra.single

  return { amount: amount + rentAssistance, rentAssistance }
}

// returns null until there's enough to work a budget out, so the UI can show
// an empty state instead of $0
export function estimateBudget(answers: IncomeAnswers): BudgetEstimate | null {
  if (!answers.source) return null

  let income = 0
  let rentAssistance = 0

  if (usesPayments(answers)) {
    const payments = weeklyPayments(answers)
    if (!payments) return null
    income += payments.amount
    rentAssistance = payments.rentAssistance
  }

  if (usesWork(answers)) {
    if (!answers.wageAmount || answers.wageAmount <= 0) return null
    income += toWeekly(answers.wageAmount, answers.wagePeriod)
  }

  if (income <= 0) return null

  return {
    weekly: roundToTen(income * AFFORDABLE_SHARE),
    incomeWeekly: cents(income),
    rentAssistanceWeekly: cents(rentAssistance),
  }
}

// parses what someone typed into a money field. accepts $1,250 or 1250.50,
// returns null for anything that isn't a positive amount
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '')
  if (cleaned === '' || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const value = Number(cleaned)
  return value > 0 ? value : null
}
