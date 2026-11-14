// every dataset the scores rely on, shown on the How it works page so each
// figure can be traced to who published it and when. names and publishers are
// proper nouns and stay as they are. what we use each one for is translated

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
}

export const DATASETS: Dataset[] = [
  {
    id: 'rental-report',
    name: 'Rental Report: quarterly moving annual rents by suburb',
    publisher: 'Homes Victoria',
    useKey: 'howItWorks.datasets.rentalReport',
    period: 'Latest quarter',
    url: 'https://discover.data.vic.gov.au/dataset/rental-report-quarterly-moving-annual-rents-by-suburb',
  },
  {
    id: 'payment-rates',
    name: 'Payment and Rent Assistance rates',
    publisher: 'Services Australia',
    useKey: 'howItWorks.datasets.paymentRates',
    period: 'September 2026',
    url: 'https://www.servicesaustralia.gov.au/how-much-rent-assistance-you-can-get',
    enteredByHand: true,
  },
  {
    id: 'census',
    name: '2021 Census DataPacks',
    publisher: 'Australian Bureau of Statistics',
    useKey: 'howItWorks.datasets.census',
    period: '2021',
    url: 'https://www.abs.gov.au/census/find-census-data/datapacks',
  },
  {
    id: 'boundaries',
    name: 'Australian Statistical Geography Standard, Edition 3',
    publisher: 'Australian Bureau of Statistics',
    useKey: 'howItWorks.datasets.boundaries',
    period: '2021 to 2026',
    url: 'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads',
  },
  {
    id: 'schools',
    name: 'School locations 2026',
    publisher: 'Department of Education',
    useKey: 'howItWorks.datasets.schools',
    period: '2026',
    url: 'https://discover.data.vic.gov.au/dataset/school-locations-2026',
  },
  {
    id: 'vicmap',
    name: 'Vicmap Features of Interest',
    publisher: 'Department of Transport and Planning',
    useKey: 'howItWorks.datasets.vicmap',
    period: '2026',
    url: 'https://discover.data.vic.gov.au/dataset/vicmap-features-of-interest',
  },
  {
    id: 'amep',
    name: 'Adult Migrant English Program providers and locations',
    publisher: 'Department of Home Affairs',
    useKey: 'howItWorks.datasets.amep',
    period: 'Checked October 2026',
    url: 'https://immi.homeaffairs.gov.au/settling-in-australia/amep/find-a-class/providers-and-locations',
    enteredByHand: true,
  },
  {
    id: 'health',
    name: 'Health services',
    publisher: 'Geoscience Australia',
    useKey: 'howItWorks.datasets.health',
    period: '2025',
  },
  {
    id: 'transport',
    name: 'Public transport stops (GTFS schedule)',
    publisher: 'Department of Transport and Planning',
    useKey: 'howItWorks.datasets.transport',
    period: '2026',
    url: 'https://opendata.transport.vic.gov.au/dataset/gtfs-schedule',
  },
  {
    id: 'crime',
    name: 'Criminal incidents, year ending June 2026',
    publisher: 'Crime Statistics Agency',
    useKey: 'howItWorks.datasets.crime',
    period: 'Year ending June 2026',
    url: 'https://discover.data.vic.gov.au/dataset/criminal-incident',
  },
]
