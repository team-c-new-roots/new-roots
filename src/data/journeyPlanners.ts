// the two planners that go address to address, for once someone has found a
// home. Google's opens straight into public transport directions
export const GOOGLE_TRANSIT = 'https://www.google.com/maps/dir/?api=1&travelmode=transit'
export const JOURNEY_PLANNER = 'https://transport.vic.gov.au/journey'

// one trip from a suburb to a place's suburb, opened in Google Maps with
// public transport picked. Maps starts at the time now and the person sets
// their own, like a 5 am shift (US 4.2). a link, no API key, and nothing goes
// to Google unless they choose to open it
export function transitTrip(from: string, to?: string): string {
  const params = new URLSearchParams({ api: '1', origin: `${from} VIC` })
  // no place, so they type their own address into Google, not into New Roots
  if (to) params.set('destination', `${to} VIC`)
  params.set('travelmode', 'transit')
  return `https://www.google.com/maps/dir/?${params}`
}
