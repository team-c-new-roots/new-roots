import { MOVE_IN } from '@/data/move-in'

export interface MoveIn {
  bond: number
  advance: number
  total: number
  // false above $900 a week, where the one month limits stop applying
  limited: boolean
}

// a calendar month of a weekly rent, worked out the way CAV's rent calculator
// does it: a day's rent times 365, over 12. a lease says this, not 4 weeks
export const monthlyRent = (weekly: number) => ((weekly / 7) * 365) / 12

const toTen = (value: number) => Math.round(value / 10) * 10

// the most they can be asked for up front: a month's bond plus a month's rent
// in advance. rounded to $10 since it's built on a median, not a real listing.
// the total is the two rounded parts so the figures on screen add up
export function moveInCost(weekly: number): MoveIn {
  const month = toTen(monthlyRent(weekly))
  return {
    bond: month,
    advance: month,
    total: month * 2,
    limited: weekly <= MOVE_IN.weeklyLimit,
  }
}
