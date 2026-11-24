import { describe, expect, it } from 'vitest'
import { WALK_LIMIT_MINUTES, walkingMinutes } from '../walking'

describe('walking times', () => {
  it('rounds to the nearest five minutes', () => {
    // 1 km is 15.6 minutes with the streets added
    expect(walkingMinutes(1)).toBe(15)
    expect(walkingMinutes(1.1)).toBe(15)
    expect(walkingMinutes(1.3)).toBe(20)
  })

  it('gives 0 when it rounds below five, so the page can say under five', () => {
    expect(walkingMinutes(0.1)).toBe(0)
    expect(walkingMinutes(0.2)).toBe(5)
  })

  it('goes past the limit by about 1.3 km, where the page switches to distance', () => {
    expect(walkingMinutes(1.2)).toBeLessThanOrEqual(WALK_LIMIT_MINUTES)
    expect(walkingMinutes(1.6)).toBeGreaterThan(WALK_LIMIT_MINUTES)
  })
})
