import type { Component } from 'vue'

export type HomeType = 'house' | 'flat' | 'either'
export type IncomeSource = 'payments' | 'work' | 'both'
// the main payment one adult gets. a person can only get one at a time.
// Family Tax Benefit is paid for the children, so it's asked once per family
export type AdultPayment = 'jobseeker' | 'parenting' | 'other' | 'none'
export type PayPeriod = 'week' | 'fortnight' | 'month'
export type Importance = 'not' | 'important' | 'very'
export type BudgetStatus = 'within' | 'close' | 'above' | 'noData'
export type SchoolNeed = 'primary' | 'secondary' | 'both' | 'none'
export type YesNo = 'yes' | 'no'

// the languages the language community step offers. each maps to its census name
export type CommunityLanguage = 'dari' | 'hazaraghi' | 'persian' | 'arabic' | 'pashto' | 'dinka'

// the seven topics the scoring module uses, spelt the way the backend spells them
export type TopicName =
  'Affordability' | 'Education' | 'Healthcare' | 'Safety' | 'Transport' | 'Language' | 'Community'

// affordability isn't rated, suburbs within budget always come first (US 2.2)
export type RatedTopic = Exclude<TopicName, 'Affordability'>

export interface AdultIncome {
  payment: AdultPayment | null
  // for another payment, what it pays each fortnight
  otherFortnight: number | null
}

export interface IncomeAnswers {
  source: IncomeSource | null
  // one per adult on step 1, in order. a couple are adults 1 and 2
  incomes: AdultIncome[]
  // only asked when there are children
  familyTax: YesNo | null
  wageAmount: number | null
  wagePeriod: PayPeriod
  adults: number
  children: number
  // only asked when there's more than one adult and someone gets payments
  couple: YesNo | null
  // children aged 13 to 19, only asked for family tax benefit
  teens: number
  youngestUnderFive: YesNo | null
}

export interface BudgetEstimate {
  // the rent budget, 30% of income, rounded to the nearest $10
  weekly: number
  // everything the household gets each week, rent assistance included. this
  // is what goes to the scoring API
  incomeWeekly: number
  rentAssistanceWeekly: number
}

// the home the rent figures describe, after fitting the request to what the
// rental report publishes
export interface HomeLabel {
  type: HomeType
  bedrooms: number
}

// one option in a radio or checkbox group
export interface ChoiceOption<V extends string | number = string> {
  value: V
  label: string
  // a second, smaller line. the English name under a native language name, say
  hint?: string
  // for labels written in another language, so screen readers switch voice
  lang?: string
  dir?: 'ltr' | 'rtl'
  // shown beside the label so the option reads without much English (US 5.1)
  icon?: Component
}
