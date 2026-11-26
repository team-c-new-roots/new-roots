import exported from './exported.json'

// every dataset the scores rely on, shown on the How it works page so each
// figure can be traced to who published it and when, and how often we bring
// it up to date. names and publishers are proper nouns and stay as they are.
// what we use each one for is translated

// the day the app's data was last exported from Gold, written by
// scripts/export_app_data.py
export const DATA_UPDATED: string = exported.exported

// how often we refresh each source. i18n keys under howItWorks.updates
export type UpdateSchedule = 'quarterly' | 'twiceYearly' | 'census' | 'checkedQuarterly'

export interface Dataset {
  id: string
  name: string
  publisher: string
  // i18n key for what New Roots uses it for
  useKey: string
  // as published, or the date the team last checked it
  period: string
  // left out where the team hasn't confirmed a stable link yet
  url?: string
  enteredByHand?: boolean
  updates: UpdateSchedule
}

export const DATASETS: Dataset[] = [
  {
    id: 'rental-report',
    updates: 'quarterly',
    name: 'Rental Report: quarterly moving annual rents by suburb and by council area',
    publisher: 'Homes Victoria',
    useKey: 'howItWorks.datasets.rentalReport',
    // moving annual medians, so a year of new leases up to this quarter
    period: 'Year to June 2026',
    url: 'https://discover.data.vic.gov.au/dataset/rental-report-quarterly-moving-annual-rents-by-suburb',
  },
  {
    id: 'affordable-lettings',
    updates: 'quarterly',
    name: 'Rental Report: affordable rental dwellings by council area',
    publisher: 'Homes Victoria',
    useKey: 'howItWorks.datasets.affordableLettings',
    period: 'June 2026',
    url: 'https://discover.data.vic.gov.au/dataset/rental-report-quarterly-affordable-rental-dwellings-by-lga',
  },
  {
    id: 'payment-rates',
    updates: 'twiceYearly',
    name: 'Payment and Rent Assistance rates',
    publisher: 'Services Australia',
    useKey: 'howItWorks.datasets.paymentRates',
    period: 'September 2026',
    url: 'https://www.servicesaustralia.gov.au/how-much-rent-assistance-you-can-get',
    enteredByHand: true,
  },
  {
    id: 'census',
    updates: 'census',
    name: '2021 Census DataPacks',
    publisher: 'Australian Bureau of Statistics',
    useKey: 'howItWorks.datasets.census',
    period: '2021',
    url: 'https://www.abs.gov.au/census/find-census-data/datapacks',
  },
  {
    id: 'boundaries',
    updates: 'census',
    name: 'Australian Statistical Geography Standard, Edition 3',
    publisher: 'Australian Bureau of Statistics',
    useKey: 'howItWorks.datasets.boundaries',
    period: '2021 to 2026',
    url: 'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads',
  },
  {
    id: 'vicmap',
    updates: 'checkedQuarterly',
    name: 'Vicmap Features of Interest',
    publisher: 'Department of Transport and Planning',
    useKey: 'howItWorks.datasets.vicmap',
    period: 'October 2026',
    url: 'https://discover.data.vic.gov.au/dataset/vicmap-features-of-interest',
  },
  {
    id: 'amep',
    updates: 'checkedQuarterly',
    name: 'Adult Migrant English Program providers and locations',
    publisher: 'Department of Home Affairs',
    useKey: 'howItWorks.datasets.amep',
    period: 'Checked October 2026',
    url: 'https://immi.homeaffairs.gov.au/settling-in-australia/amep/find-a-class/providers-and-locations',
    enteredByHand: true,
  },
  {
    id: 'health',
    updates: 'checkedQuarterly',
    name: 'General practices, hospitals and pharmacies',
    publisher: 'Geoscience Australia',
    useKey: 'howItWorks.datasets.health',
    period: 'October 2026',
  },
  {
    id: 'services-australia',
    updates: 'checkedQuarterly',
    name: 'Services Australia Office Locations',
    publisher: 'Services Australia, through the Digital Atlas of Australia',
    useKey: 'howItWorks.datasets.servicesAustralia',
    period: 'August 2023',
    url: 'https://catalogue.data.infrastructure.gov.au/dataset/rdh-servicesaustraliaofficelocations',
  },
  {
    id: 'transport',
    updates: 'checkedQuarterly',
    name: 'Public transport stops (GTFS schedule)',
    publisher: 'Department of Transport and Planning',
    useKey: 'howItWorks.datasets.transport',
    period: 'October 2026',
    url: 'https://opendata.transport.vic.gov.au/dataset/gtfs-schedule',
  },
  {
    id: 'crime',
    updates: 'quarterly',
    name: 'Criminal incidents, year ending June 2026',
    publisher: 'Crime Statistics Agency',
    useKey: 'howItWorks.datasets.crime',
    period: 'Year ending June 2026',
    url: 'https://discover.data.vic.gov.au/dataset/criminal-incident',
  },
]
