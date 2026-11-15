import type { AdultIncome, BudgetEstimate, IncomeAnswers, PayPeriod } from '@/types'
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
function weeklyPayments(answers: IncomeAnswers): { amount: number; rentAssistance: number } | null {
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
  let amount = 0
  let fromCentrelink = familyTax

  for (const [index, person] of people.entries()) {
    const partnered = couple && index < 2
    if (person.payment === 'parenting') {
      const rate = partnered ? 'partnered' : 'single'
      amount += RATES.parenting[rate] + RATES.parentingEnergy[rate]
      fromCentrelink = true
    } else if (person.payment === 'jobseeker') {
      let rate: 'partnered' | 'singleWithChildren' | 'singleNoChildren' = 'singleNoChildren'
      if (partnered) rate = 'partnered'
      else if (singleParentRate) {
        rate = 'singleWithChildren'
        singleParentRate = false
      }
      amount += RATES.jobseeker[rate] + RATES.jobseekerEnergy[rate]
      fromCentrelink = true
    } else if (person.payment === 'other') {
      if (!person.otherFortnight || person.otherFortnight <= 0) return null
      amount += toWeekly(person.otherFortnight, 'fortnight')
      fromCentrelink = true
    }
  }

  // nobody gets anything from Centrelink, so there's no rent assistance either
  if (!fromCentrelink) return null

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
