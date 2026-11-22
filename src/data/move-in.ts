import { SUPPORT_SERVICES } from './support-services'

/* what a rental provider in Victoria can ask for before you move in (US 1.3).
   when rent is $900 a week or less the bond is at most a month's rent, and so
   is rent in advance. above $900 there's no cap. checked on the Consumer
   Affairs Victoria bond page, so recheck it and the date if the law changes */
export const MOVE_IN = {
  checked: '2026-11-22',
  weeklyLimit: 900,
  cavUrl:
    'https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/bond/bond-payments-and-amounts',
  // same link as the support page, so the two can't drift apart
  bondLoanUrl: SUPPORT_SERVICES.find((service) => service.id === 'bondLoans')?.url ?? '',
}
