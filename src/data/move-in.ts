import { SUPPORT_SERVICES } from './support-services'

/* what a rental provider in Victoria can ask for before you move in (US 1.3).
   when rent is $900 a week or less the bond is at most a month's rent, and so
   is rent in advance. above $900 there's no cap. from the Consumer Affairs
   Victoria bond page, which the app links to */
export const MOVE_IN = {
  weeklyLimit: 900,
  cavUrl:
    'https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/bond/bond-payments-and-amounts',
  // same link as the support page, so the two can't drift apart
  bondLoanUrl: SUPPORT_SERVICES.find((service) => service.id === 'bondLoans')?.url ?? '',
}
