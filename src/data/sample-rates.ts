// made up round numbers so the budget screen has something to show. NOT real
// Services Australia rates. the data team swaps these for the published rates,
// each stored with the date it was checked, because the rates change twice a year

export interface PaymentRates {
  // dollars per fortnight, which is how Centrelink pays
  parenting: number
  jobseeker: number
  familyTaxPerChild: number
  rentAssistance: number
}

export const SAMPLE_RATES: PaymentRates = {
  parenting: 1000,
  jobseeker: 800,
  familyTaxPerChild: 200,
  rentAssistance: 200,
}
