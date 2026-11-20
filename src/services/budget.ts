import type { AdultIncome, BudgetEstimate, BudgetPart, IncomeAnswers, PayPeriod } from '@/types'
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
export function needsCoupleAnswer(answers: Pick<IncomeAnswers, 'source' | 'adults'>): boolean {
  return usesPayments(answers) && answers.adults > 1
}

function isCouple(answers: Pick<IncomeAnswers, 'adults' | 'couple'>): boolean {
  return answers.adults > 1 && answers.couple === 'yes'
}

export function blankAdult(): AdultIncome {
  return { payment: null, otherFortnight: null }
}

// one answer per adult on step 1, blank for anyone not answered yet
export function incomesOf(answers: Pick<IncomeAnswers, 'incomes' | 'adults'>): AdultIncome[] {
  return Array.from(
    { length: answers.adults },
    (_, index) => answers.incomes[index] ?? blankAdult(),
  )
}

// only one of a couple can be the carer who gets parenting payment
export function bothPartnersOnParenting(
  answers: Pick<IncomeAnswers, 'incomes' | 'adults' | 'couple'>,
): boolean {
  const [first, second] = incomesOf(answers)
  return isCouple(answers) && first?.payment === 'parenting' && second?.payment === 'parenting'
}

/* each adult's own payment plus its energy supplement, at maximum rates, then
   family tax benefit once for the children and rent assistance once for the
   household. rent assistance counts as income, the way the scoring module and
   the rental report's affordability measure treat it, then the budget is 30%
   of the lot. returns null while an answer it needs is missing.

   a couple are adults 1 and 2 and get the partnered rates. anyone else, like
   a grown-up child, is single. one single parent on jobseeker gets the higher
   with-children rate, unless the carer is already on parenting payment */
function weeklyPayments(
  answers: IncomeAnswers,
): { parts: BudgetPart[]; rentAssistance: number } | null {
  const hasChildren = answers.children > 0
  const couple = isCouple(answers)
  const people = incomesOf(answers)
  if (needsCoupleAnswer(answers) && answers.couple === null) return null
  if (hasChildren && answers.familyTax === null) return null
  // parenting payment needs children, so one left from before they were taken off is unanswered
  if (people.some(({ payment }) => payment === null || (payment === 'parenting' && !hasChildren))) {
    return null
  }
  if (bothPartnersOnParenting(answers)) return null

  const familyTax = hasChildren && answers.familyTax === 'yes'
  let singleParentRate =
    !couple && hasChildren && !people.some(({ payment }) => payment === 'parenting')
  const parts: BudgetPart[] = []
  let fromCentrelink = familyTax

  for (const [index, person] of people.entries()) {
    const partnered = couple && index < 2
    if (person.payment === 'parenting') {
      const rate = partnered ? 'partnered' : 'single'
      const weekly = RATES.parenting[rate] + RATES.parentingEnergy[rate]
      parts.push({ kind: 'payment', adult: index + 1, payment: 'parenting', weekly })
      fromCentrelink = true
    } else if (person.payment === 'jobseeker') {
      let rate: 'partnered' | 'singleWithChildren' | 'singleNoChildren' = 'singleNoChildren'
      if (partnered) rate = 'partnered'
      else if (singleParentRate) {
        rate = 'singleWithChildren'
        singleParentRate = false
      }
      const weekly = RATES.jobseeker[rate] + RATES.jobseekerEnergy[rate]
      parts.push({ kind: 'payment', adult: index + 1, payment: 'jobseeker', weekly })
      fromCentrelink = true
    } else if (person.payment === 'other') {
      if (!person.otherFortnight || person.otherFortnight <= 0) return null
      const weekly = toWeekly(person.otherFortnight, 'fortnight')
      parts.push({ kind: 'payment', adult: index + 1, payment: 'other', weekly })
      fromCentrelink = true
    }
  }

  // nobody gets anything from Centrelink, so there's no rent assistance either
  if (!fromCentrelink) return null

  if (familyTax) {
    const teens = Math.min(answers.teens, answers.children)
    const younger = answers.children - teens
    let weekly = younger * (RATES.ftbA.child0to12 + RATES.ftbAEnergy.child0to12)
    weekly += teens * (RATES.ftbA.child13to19 + RATES.ftbAEnergy.child13to19)
    // until they say, assume the youngest is 5 or older, the lower rate
    const underFive = answers.youngestUnderFive === 'yes'
    weekly += underFive ? RATES.ftbB.youngestUnder5 : RATES.ftbB.youngest5to18
    weekly += underFive ? RATES.ftbBEnergy.youngestUnder5 : RATES.ftbBEnergy.youngest5to18
    parts.push({ kind: 'familyTax', weekly })
  }

  const ra = RATES.rentAssistance
  const manyChildren = answers.children >= 3
  const rentAssistance = familyTax
    ? couple
      ? manyChildren
        ? ra.coupleFtb3plus
        : ra.coupleFtb1to2
      : manyChildren
        ? ra.singleFtb3plus
        : ra.singleFtb1to2
    : couple
      ? ra.couple
      : ra.single

  parts.push({ kind: 'rentAssistance', weekly: rentAssistance })
  return { parts, rentAssistance }
}

// every amount that goes into the budget, one line each, for the "how we
// worked this out" breakdown. null until there's enough to work it out
export function budgetParts(answers: IncomeAnswers): BudgetPart[] | null {
  if (!answers.source) return null
  const parts: BudgetPart[] = []

  if (usesPayments(answers)) {
    const payments = weeklyPayments(answers)
    if (!payments) return null
    parts.push(...payments.parts)
  }

  if (usesWork(answers)) {
    if (!answers.wageAmount || answers.wageAmount <= 0) return null
    parts.push({
      kind: 'wage',
      weekly: toWeekly(answers.wageAmount, answers.wagePeriod),
      amount: answers.wageAmount,
      period: answers.wagePeriod,
    })
  }

  return parts.length ? parts : null
}

// returns null until there's enough to work a budget out, so the UI can show
// an empty state instead of $0
export function estimateBudget(answers: IncomeAnswers): BudgetEstimate | null {
  const parts = budgetParts(answers)
  if (!parts) return null

  const income = parts.reduce((total, part) => total + part.weekly, 0)
  if (income <= 0) return null
  const rentAssistance = parts.find((part) => part.kind === 'rentAssistance')?.weekly ?? 0

  return {
    weekly: roundToTen(income * AFFORDABLE_SHARE),
    incomeWeekly: cents(income),
    rentAssistanceWeekly: cents(rentAssistance),
  }
}

// the most each money field takes. well past anyone this is for, and low
// enough that a slip of the finger can't push the budget off the screen
export const WAGE_MAX: Record<PayPeriod, number> = { week: 10000, fortnight: 20000, month: 40000 }
export const OTHER_PAYMENT_MAX = 5000
// "$40,000.00" is 10 characters, so the field stops there
export const MONEY_MAX_LENGTH = 10

export type MoneyProblem = 'empty' | 'negative' | 'zero' | 'notNumber' | 'decimals' | 'tooBig'

// what someone typed into a money field, and what's wrong with it if anything,
// so the error can say exactly what to change. $1,250 and 1250.50 are fine
export function checkMoney(
  text: string,
  max = Number.POSITIVE_INFINITY,
): { value: number | null; problem: MoneyProblem | null } {
  const cleaned = text.replace(/[$,\s]/g, '')
  if (cleaned === '') return { value: null, problem: 'empty' }
  // a hyphen, a minus sign or an en dash all read as minus
  if (/^[-\u2212\u2013]/.test(cleaned)) return { value: null, problem: 'negative' }
  if (/^\d+\.\d{3,}$/.test(cleaned)) return { value: null, problem: 'decimals' }
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(cleaned)) return { value: null, problem: 'notNumber' }
  const value = Number(cleaned)
  if (value === 0) return { value: null, problem: 'zero' }
  if (value > max) return { value: null, problem: 'tooBig' }
  return { value, problem: null }
}

// the number a money field means, or null for anything that isn't a positive amount
export function parseMoney(text: string): number | null {
  return checkMoney(text).value
}
