import { describe, expect, it } from 'vitest'
import { budgetFit, rankSuburbs, statusFor } from '../ranking'
import { SAMPLE_SUBURBS } from '@/data/sample-suburbs'
import type { Preferences, Suburb } from '@/types'

function suburb(
  id: string,
  house4: number | null,
  dari: number | null,
  extra: Partial<Suburb> = {},
): Suburb {
  return {
    id,
    name: id,
    lga: 'Test',
    rents: house4 === null ? null : { house4 },
    languages: dari === null ? null : { dari },
    schoolPrimaryKm: 1,
    schoolSecondaryKm: 2,
    englishClassKm: 1,
    essentialsScore: 70,
    crimeRate: 50,
    crimeScore: 60,
    ...extra,
  }
}

const prefs: Preferences = {
  budget: 520,
  bedrooms: 4,
  homeType: 'house',
  communityLanguage: 'dari',
  importance: { community: 'very', essentials: 'important', crime: 'not' },
}

describe('budgetFit and statusFor', () => {
  it('scores 80 at exactly the budget and 0 at 30% over', () => {
    expect(budgetFit(520, 520)).toBe(80)
    expect(budgetFit(676, 520)).toBe(0)
    expect(budgetFit(300, 520)).toBe(100)
  })

  it('calls up to 10% over close to budget', () => {
    expect(statusFor(520, 520)).toBe('within')
    expect(statusFor(572, 520)).toBe('close')
    expect(statusFor(573, 520)).toBe('over')
  })
})

describe('rankSuburbs', () => {
  it('puts within budget ahead of close to budget, whatever the match', () => {
    const { ranked } = rankSuburbs(
      [suburb('close-but-great', 560, 20), suburb('within-but-plain', 500, 0)],
      prefs,
    )
    expect(ranked.map((item) => item.suburb.id)).toEqual(['within-but-plain', 'close-but-great'])
  })

  it('lets community reorder suburbs but never hide one', () => {
    const suburbs = [suburb('a', 500, 1), suburb('b', 500, 9)]
    const withCommunity = rankSuburbs(suburbs, prefs).ranked
    const without = rankSuburbs(suburbs, { ...prefs, communityLanguage: null }).ranked
    expect(withCommunity.map((item) => item.suburb.id)).toEqual(['b', 'a'])
    expect(without).toHaveLength(2)
  })

  it('leaves out topics rated Not important', () => {
    const { ranked } = rankSuburbs([suburb('a', 500, 5)], prefs)
    expect(ranked[0]?.counted.crime).toBe(false)
  })

  it('drops missing data out of the average instead of scoring it 0', () => {
    const missing = rankSuburbs([suburb('a', 500, null)], prefs).ranked[0]
    const zero = rankSuburbs([suburb('a', 500, 0), suburb('b', 900, 5)], prefs).ranked[0]
    expect(missing?.scores.community).toBeNull()
    expect(missing?.match).toBeGreaterThan(zero?.match ?? 0)
  })

  it('marks a suburb with no rent data instead of ranking it', () => {
    const { all, ranked } = rankSuburbs([suburb('gap', null, 5), suburb('ok', 500, 5)], prefs)
    expect(all.find((item) => item.suburb.id === 'gap')?.status).toBe('noData')
    expect(ranked).toHaveLength(1)
  })

  it('shows the three closest when nothing fits', () => {
    const { ranked, closest } = rankSuburbs(
      [suburb('a', 900, 5), suburb('b', 700, 5), suburb('c', 800, 5), suburb('d', 1000, 5)],
      prefs,
    )
    expect(ranked).toHaveLength(0)
    expect(closest.map((item) => item.difference)).toEqual([180, 280, 380])
  })
})

// the sample data is tuned to the personas, so the demo matches the wireframes
describe('sample data stories', () => {
  it('gives Mariam Doveton, Dandenong and Hallam as her top three', () => {
    const { ranked } = rankSuburbs(SAMPLE_SUBURBS, prefs)
    expect(ranked.slice(0, 3).map((item) => item.suburb.name)).toEqual([
      'Doveton',
      'Dandenong',
      'Hallam',
    ])
  })

  it('gives Reza nothing that fits at $210, with Broadmeadows closest', () => {
    const { ranked, closest } = rankSuburbs(SAMPLE_SUBURBS, {
      budget: 210,
      bedrooms: 1,
      homeType: 'flat',
      communityLanguage: 'persian',
      importance: { community: 'important', essentials: 'important', crime: 'not' },
    })
    expect(ranked).toHaveLength(0)
    expect(closest.map((item) => [item.suburb.name, item.difference])).toEqual([
      ['Broadmeadows', 130],
      ['Dallas', 140],
      ['Meadow Heights', 150],
    ])
  })
})
