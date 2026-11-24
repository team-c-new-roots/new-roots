/* walking times for nearby services (US 4.3). the distances are straight
   lines from the middle of the suburb, so they're stretched by a third for
   the streets in between, then walked at 5 km an hour. rounded to the
   nearest five minutes, since anything finer would claim more than it knows */

export const STREET_FACTOR = 1.3
export const WALK_KMH = 5

// past this the time stops helping, so the page gives the distance alone
export const WALK_LIMIT_MINUTES = 20

// minutes, or 0 for anything that rounds below five
export function walkingMinutes(km: number): number {
  const minutes = ((km * STREET_FACTOR) / WALK_KMH) * 60
  return Math.round(minutes / 5) * 5
}
