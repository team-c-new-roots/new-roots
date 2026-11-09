/* the support directory. a static module on purpose, same call as the iris
   crisis page: these numbers change maybe once a year, a deploy is the right
   way to change them, and a page of phone numbers should not depend on a
   database being reachable.

   every number and link was checked against the service's own site (or the
   ASRC legal referral sheet for the advice line hours) in November 2026.
   names are proper nouns and stay in English. descriptions live in the i18n
   files under support.services so translators find all the words in one place */

export type ServiceCategory =
  'urgent' | 'housing' | 'settlement' | 'legal' | 'health' | 'english' | 'money'

export interface SupportService {
  id: string
  name: string
  categories: ServiceCategory[]
  phone?: string
  // digits only, for the tel: link
  tel?: string
  url?: string
  // i18n key under support.hours, left out when the service doesn't publish set hours
  hours?: 'always' | 'refugeeLegal' | 'legalAid' | 'servicesAustralia'
  // set when who can use it depends on visa. shown on the card, and the
  // seeking asylum filter hides anything marked permanentOnly
  visaNote?: 'permanentOnly' | 'checkVisa'
}

export const CATEGORIES: ServiceCategory[] = [
  'urgent',
  'housing',
  'settlement',
  'legal',
  'health',
  'english',
  'money',
]

export const SUPPORT_CHECKED = 'November 2026'

export const SUPPORT_SERVICES: SupportService[] = [
  {
    id: 'emergency',
    name: 'Triple zero (000)',
    categories: ['urgent'],
    phone: '000',
    tel: '000',
    hours: 'always',
  },
  {
    id: 'safeSteps',
    name: 'Safe Steps',
    categories: ['urgent'],
    phone: '1800 015 188',
    tel: '1800015188',
    url: 'https://www.safesteps.org.au',
    hours: 'always',
  },
  {
    id: 'respect',
    name: '1800RESPECT',
    categories: ['urgent'],
    phone: '1800 737 732',
    tel: '1800737732',
    url: 'https://www.1800respect.org.au',
    hours: 'always',
  },
  {
    id: 'lifeline',
    name: 'Lifeline',
    categories: ['urgent', 'health'],
    phone: '13 11 14',
    tel: '131114',
    url: 'https://www.lifeline.org.au',
    hours: 'always',
  },
  {
    id: 'openingDoors',
    name: 'Opening Doors',
    categories: ['urgent', 'housing'],
    phone: '1800 825 955',
    tel: '1800825955',
    url: 'https://services.dffh.vic.gov.au/getting-help',
    hours: 'always',
  },
  {
    id: 'tis',
    name: 'TIS National',
    categories: ['urgent', 'settlement'],
    phone: '131 450',
    tel: '131450',
    url: 'https://www.tisnational.gov.au',
    hours: 'always',
  },
  {
    id: 'tenantsVic',
    name: 'Tenants Victoria',
    categories: ['housing', 'legal'],
    phone: '(03) 9416 2577',
    tel: '0394162577',
    url: 'https://tenantsvic.org.au',
  },
  {
    id: 'bondLoans',
    name: 'Homes Victoria bond loans',
    categories: ['housing', 'money'],
    url: 'https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/bond/homes-victoria-bond-loans',
    visaNote: 'permanentOnly',
  },
  {
    id: 'askIzzy',
    name: 'Ask Izzy',
    categories: ['housing', 'money'],
    url: 'https://askizzy.org.au',
  },
  {
    id: 'ames',
    name: 'AMES Australia',
    categories: ['settlement', 'english'],
    phone: '13 26 37',
    tel: '132637',
    url: 'https://www.ames.net.au',
    visaNote: 'checkVisa',
  },
  {
    id: 'asrc',
    name: 'Asylum Seeker Resource Centre',
    categories: ['settlement', 'legal', 'health', 'money'],
    phone: '(03) 9326 6066',
    tel: '0393266066',
    url: 'https://asrc.org.au',
  },
  {
    id: 'refugeeLegal',
    name: 'Refugee Legal',
    categories: ['legal'],
    phone: '(03) 9413 0100',
    tel: '0394130100',
    url: 'https://refugeelegal.org.au',
    hours: 'refugeeLegal',
  },
  {
    id: 'legalAid',
    name: 'Victoria Legal Aid',
    categories: ['legal'],
    phone: '1300 792 387',
    tel: '1300792387',
    url: 'https://www.legalaid.vic.gov.au',
    hours: 'legalAid',
  },
  {
    id: 'foundationHouse',
    name: 'Foundation House',
    categories: ['health'],
    phone: '(03) 9389 8900',
    tel: '0393898900',
    url: 'https://foundationhouse.org.au',
  },
  {
    id: 'healthdirect',
    name: 'healthdirect',
    categories: ['health'],
    phone: '1800 022 222',
    tel: '1800022222',
    url: 'https://www.healthdirect.gov.au',
    hours: 'always',
  },
  {
    id: 'amep',
    name: 'Adult Migrant English Program',
    categories: ['english'],
    url: 'https://immi.homeaffairs.gov.au/settling-in-australia/amep/find-a-class/providers-and-locations',
    visaNote: 'checkVisa',
  },
  {
    id: 'findMySchool',
    name: 'Find My School',
    categories: ['english'],
    url: 'https://www.findmyschool.vic.gov.au',
  },
  {
    id: 'servicesAustralia',
    name: 'Services Australia in your language',
    categories: ['money'],
    phone: '131 202',
    tel: '131202',
    url: 'https://www.servicesaustralia.gov.au/yourlanguage',
    hours: 'servicesAustralia',
    visaNote: 'checkVisa',
  },
]
