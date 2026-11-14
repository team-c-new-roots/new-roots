import payments from './payments.json'

/* weekly maximum rates, exported from the data team's Centrelink payments
   table by scripts/export_app_data.py, so nothing here is typed in by hand.
   rerun the export when the table changes. ratesFrom is the date the rates
   started, 2026-09-20 say */

export interface Rates {
  parenting: { single: number; partnered: number }
  parentingEnergy: { single: number; partnered: number }
  jobseeker: { singleNoChildren: number; singleWithChildren: number; partnered: number }
  jobseekerEnergy: { singleNoChildren: number; singleWithChildren: number; partnered: number }
  // part A is per child and depends on age, part B is one per family
  ftbA: { child0to12: number; child13to19: number }
  ftbAEnergy: { child0to12: number; child13to19: number }
  ftbB: { youngestUnder5: number; youngest5to18: number }
  ftbBEnergy: { youngestUnder5: number; youngest5to18: number }
  // maximum rent assistance. melbourne rents are high enough that most people
  // on payments get the maximum
  rentAssistance: {
    single: number
    couple: number
    singleFtb1to2: number
    singleFtb3plus: number
    coupleFtb1to2: number
    coupleFtb3plus: number
  }
}

export const RATES: Rates = payments.rates
export const RATES_FROM: string = payments.ratesFrom
