/* weekly maximum rates, entered by hand from Services Australia by the data
   team (silver/centrelink_weekly_payments.csv). only the rows the income step
   uses. the team's data sources list has these as September 2026 rates, so
   check the date with the data team whenever the table is refreshed */

export const RATES_FROM = 'September 2026'

export const RATES = {
  parenting: { single: 543.6, partnered: 381.5 },
  parentingEnergy: { single: 6, partnered: 3.95 },

  jobseeker: { singleNoChildren: 416.85, singleWithChildren: 446.4, partnered: 381.5 },
  jobseekerEnergy: { singleNoChildren: 4.4, singleWithChildren: 4.75, partnered: 3.95 },

  // part A is per child and depends on age, part B is one per family
  ftbA: { child0to12: 117.74, child13to19: 153.23 },
  ftbAEnergy: { child0to12: 1.75, child13to19: 2.24 },
  ftbB: { youngestUnder5: 100.17, youngest5to18: 69.93 },
  ftbBEnergy: { youngestUnder5: 1.4, youngest5to18: 0.98 },

  // maximum rent assistance. melbourne rents are high enough that most people
  // on payments get the maximum
  rentAssistance: { single: 111.9, couple: 105.5, withFtb1to2: 131.53, withFtb3plus: 148.68 },
} as const
