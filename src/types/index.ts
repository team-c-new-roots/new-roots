export type HomeType = 'house' | 'flat' | 'either'
export type IncomeSource = 'payments' | 'work' | 'both'
export type PaymentType = 'parenting' | 'jobseeker' | 'familyTax' | 'other'
export type PayPeriod = 'week' | 'fortnight' | 'month'
export type Importance = 'not' | 'important' | 'very'
export type Topic = 'community' | 'essentials' | 'crime'
export type BudgetStatus = 'within' | 'close' | 'over' | 'noData'

// the languages the sample census data covers. the data team can grow this list
export type CommunityLanguage = 'dari' | 'hazaraghi' | 'persian' | 'arabic' | 'pashto' | 'dinka'

// rental report categories. it has 1 to 3 bed flats and 2 to 4 bed houses, nothing else
export type RentKey = 'flat1' | 'flat2' | 'flat3' | 'house2' | 'house3' | 'house4'

export interface Suburb {
  id: string
  name: string
  lga: string
  // weekly medians. null means not enough data for the suburb at all
  rents: Partial<Record<RentKey, number>> | null
  // percent of residents who speak each language at home
  languages: Partial<Record<CommunityLanguage, number>> | null
  schoolPrimaryKm: number | null
  schoolSecondaryKm: number | null
  englishClassKm: number | null
  // 0 to 100, worked out ahead of time by the data pipeline
  essentialsScore: number | null
  // reported incidents per 1,000 residents, and a 0 to 100 score where higher is fewer
  crimeRate: number | null
  crimeScore: number | null
}

export interface IncomeAnswers {
  source: IncomeSource | null
  payments: PaymentType[]
  otherPaymentFortnight: number | null
  wageAmount: number | null
  wagePeriod: PayPeriod
  children: number
}

export interface BudgetEstimate {
  weekly: number
  incomeWeekly: number
  rentAssistanceWeekly: number
}

export interface HomeLabel {
  type: 'house' | 'flat'
  bedrooms: number
}

export interface Preferences {
  budget: number
  bedrooms: number
  homeType: HomeType
  communityLanguage: CommunityLanguage | null
  importance: Record<Topic, Importance>
}

export interface TopicScores {
  budget: number | null
  community: number | null
  essentials: number | null
  crime: number | null
}

export interface RankedSuburb {
  suburb: Suburb
  home: HomeLabel | null
  median: number | null
  status: BudgetStatus
  // median minus budget. positive means over budget
  difference: number | null
  scores: TopicScores
  counted: Record<Topic, boolean>
  match: number | null
  rank: number | null
}

export interface RankingResult {
  ranked: RankedSuburb[]
  all: RankedSuburb[]
  closest: RankedSuburb[]
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
}
