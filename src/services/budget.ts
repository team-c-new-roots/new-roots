import type { BudgetEstimate, IncomeAnswers, PayPeriod } from '@/types'
import { SAMPLE_RATES, type PaymentRates } from '@/data/sample-rates'

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

// returns null until there's enough to work a budget out, so the UI can show
// an empty state instead of $0
export function estimateBudget(
  answers: IncomeAnswers,
  rates: PaymentRates = SAMPLE_RATES,
): BudgetEstimate | null {
  if (!answers.source) return null

  const usesPayments = answers.source === 'payments' || answers.source === 'both'
  const usesWork = answers.source === 'work' || answers.source === 'both'

  let fortnightly = 0
  if (usesPayments) {
    if (answers.payments.length === 0) return null
    for (const payment of answers.payments) {
      if (payment === 'parenting') fortnightly += rates.parenting
      if (payment === 'jobseeker') fortnightly += rates.jobseeker
      if (payment === 'familyTax') fortnightly += rates.familyTaxPerChild * answers.children
      if (payment === 'other') {
        if (!answers.otherPaymentFortnight || answers.otherPaymentFortnight <= 0) return null
        fortnightly += answers.otherPaymentFortnight
      }
    }
  }

  let incomeWeekly = fortnightly / 2
  if (usesWork) {
    if (!answers.wageAmount || answers.wageAmount <= 0) return null
    incomeWeekly += toWeekly(answers.wageAmount, answers.wagePeriod)
  }

  // rent assistance only comes with a Centrelink payment. people seeking asylum
  // on a bridging visa usually can't get either, which is why work income
  // has its own path and never adds it
  const rentAssistanceWeekly = usesPayments ? rates.rentAssistance / 2 : 0

  return {
    weekly: roundToTen(incomeWeekly * AFFORDABLE_SHARE + rentAssistanceWeekly),
    incomeWeekly: Math.round(incomeWeekly),
    rentAssistanceWeekly: Math.round(rentAssistanceWeekly),
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
