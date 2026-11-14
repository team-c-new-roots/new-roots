import type { TopicName } from '@/types'

export type MetricUnit = 'km' | 'dollars' | 'per1000' | 'perKm2'

export interface MetricInfo {
  topic: TopicName
  unit: MetricUnit
}

// every obt metric the UI can name, keyed by its column stem (rent_2br_flat,
// gp_proximity). labels live under metrics. in the i18n file, in plain English
// rather than column names
export const METRICS: Record<string, MetricInfo> = {
  rent_1br_flat: { topic: 'Affordability', unit: 'dollars' },
  rent_2br_flat: { topic: 'Affordability', unit: 'dollars' },
  rent_2br_house: { topic: 'Affordability', unit: 'dollars' },
  rent_3br_house: { topic: 'Affordability', unit: 'dollars' },
  rent_4br_house: { topic: 'Affordability', unit: 'dollars' },
  english_class_proximity: { topic: 'Education', unit: 'km' },
  primary_school_proximity: { topic: 'Education', unit: 'km' },
  secondary_school_proximity: { topic: 'Education', unit: 'km' },
  gp_proximity: { topic: 'Healthcare', unit: 'km' },
  hospital_proximity: { topic: 'Healthcare', unit: 'km' },
  bus_tram_stop_density: { topic: 'Transport', unit: 'perKm2' },
  train_station_proximity: { topic: 'Transport', unit: 'km' },
  crime_per_1000: { topic: 'Safety', unit: 'per1000' },
  crime_person_per_1000: { topic: 'Safety', unit: 'per1000' },
  crime_property_per_1000: { topic: 'Safety', unit: 'per1000' },
}

// the rental report publishes flats up to 2 bedrooms and houses from 2 to 4
export const PUBLISHED_RENTS = {
  flat: [1, 2],
  house: [2, 3, 4],
} as const

// a school further than this counts as none nearby (US 4.1)
export const SCHOOL_NEARBY_KM = 3
