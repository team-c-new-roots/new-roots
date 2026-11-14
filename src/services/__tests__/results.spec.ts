import { describe, expect, it } from 'vitest'
import type { MapData, ObtRow, ResultRow } from '@/types/scoring'
import {
  bandFor,
  budgetStatus,
  buildResults,
  cleanName,
  insights,
  languageShare,
  topLanguages,
} from '../results'

function row(id: string, overrides: Partial<ResultRow> = {}): ResultRow {
  return {
    suburb_id: id,
    suburb_name: `Suburb ${id}`,
    affordability_score: 50,
    selected_weekly_rent: 400,
    rent_to_income_pct: 25,
    affordability_cap: 95,
    education_score: 50,
    healthcare_score: 50,
    safety_score: 50,
    transport_score: 50,
    language_score: 50,
    community_score: 50,
    overall_score: 50,
    overall_rank: 1,
    ...overrides,
  }
}

function obt(id: string, rankings: Record<string, number> = {}): ObtRow {
  const metrics: Record<string, number> = {}
  for (const [metric, rank] of Object.entries(rankings)) metrics[`${metric}_ranking`] = rank
  return { suburb_id: id, suburb_name: `Suburb ${id}`, suburb_area_km2: 4, ...metrics }
}

function data(results: ResultRow[], extra: Partial<MapData> = {}): MapData {
  return {
    results,
    obt: results.map((item) => obt(item.suburb_id)),
    lookup: [],
    languages: [],
    infrastructure: [],
    selectedLanguage: null,
    ...extra,
  }
}

describe('budgetStatus', () => {
  it('splits on 30% and 35% of income, the same lines as affordability_cap', () => {
    expect(budgetStatus(row('a', { rent_to_income_pct: 30 }))).toBe('within')
    expect(budgetStatus(row('a', { rent_to_income_pct: 32 }))).toBe('close')
    expect(budgetStatus(row('a', { rent_to_income_pct: 36 }))).toBe('above')
  })

  it('reads a rent of 0 as missing, not as costing nothing', () => {
    expect(budgetStatus(row('a', { selected_weekly_rent: 0, rent_to_income_pct: 0 }))).toBe(
      'noData',
    )
    expect(budgetStatus(row('a', { selected_weekly_rent: null, rent_to_income_pct: null }))).toBe(
      'noData',
    )
  })
})

describe('bandFor', () => {
  it('colours by the score itself in bands of 20, so a 54 always looks like a 54', () => {
    expect(bandFor(54)).toBe(3)
    expect(bandFor(59.6)).toBe(4)
    expect(bandFor(85)).toBe(5)
    expect(bandFor(0)).toBe(1)
    expect(bandFor(null)).toBeUndefined()
  })
})

describe('buildResults', () => {
  it('puts every within-budget suburb ahead of close ones, whatever the score (US 2.3)', () => {
    const { ranked } = buildResults(
      data([
        row('close-high', { rent_to_income_pct: 33, overall_score: 90 }),
        row('within-low', { rent_to_income_pct: 28, overall_score: 40 }),
        row('within-high', { rent_to_income_pct: 20, overall_score: 70 }),
        row('above', { rent_to_income_pct: 45, overall_score: 99 }),
        row('missing', { selected_weekly_rent: 0, rent_to_income_pct: 0, overall_score: 95 }),
      ]),
      500,
    )
    expect(ranked.map((item) => item.id)).toEqual(['within-high', 'within-low', 'close-high'])
    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 3])
  })

  it('offers the cheapest suburbs with a rent figure when nothing fits', () => {
    const result = buildResults(
      data([
        row('a', { selected_weekly_rent: 480, rent_to_income_pct: 60 }),
        row('b', { selected_weekly_rent: 0, rent_to_income_pct: 0 }),
        row('c', { selected_weekly_rent: 350, rent_to_income_pct: 50 }),
      ]),
      210,
    )
    expect(result.ranked).toHaveLength(0)
    expect(result.closest.map((item) => item.id)).toEqual(['c', 'a'])
    expect(result.closest[0]?.overBy).toBe(140)
  })

  it('rounds the match to a whole number for display', () => {
    const { all } = buildResults(data([row('a', { overall_score: 85.25 })]), 500)
    expect(all[0]?.match).toBe(85)
  })
})

describe('names and languages', () => {
  it('drops the census (Vic.) suffix', () => {
    expect(cleanName('Sydenham (Vic.)')).toBe('Sydenham')
    expect(cleanName('Doveton')).toBe('Doveton')
  })

  const languages = data([row('a')], {
    languages: [
      {
        suburb_id: 'a',
        language: 'Dari',
        percent_spoken: 9.2,
        language_score: 90,
        language_ranking: 1,
      },
      {
        suburb_id: 'a',
        language: 'Arabic',
        percent_spoken: 2.1,
        language_score: 40,
        language_ranking: 9,
      },
      {
        suburb_id: 'a',
        language: 'Dinka',
        percent_spoken: 0,
        language_score: 0,
        language_ranking: 400,
      },
      {
        suburb_id: 'a',
        language: 'Vietnamese',
        percent_spoken: 4,
        language_score: 60,
        language_ranking: 5,
      },
    ],
  })

  it('lists the most spoken languages and leaves out empty rows', () => {
    expect(topLanguages(languages, 'a').map((item) => item.language)).toEqual([
      'Dari',
      'Vietnamese',
      'Arabic',
    ])
  })

  it('treats 0% as too few speakers to report (US 3.1)', () => {
    expect(languageShare(languages, 'a', 'Dari')).toBe(9.2)
    expect(languageShare(languages, 'a', 'Dinka')).toBeNull()
    expect(languageShare(languages, 'a', 'Pashto')).toBeNull()
  })
})

describe('insights', () => {
  const rows = [row('a'), row('b'), row('c'), row('d')]
  const mapData = data(rows, {
    obt: [
      obt('a', {
        gp_proximity: 1,
        train_station_proximity: 4,
        crime_per_1000: 1,
        rent_2br_flat: 2,
        rent_4br_house: 1,
        english_class_proximity: 3,
      }),
      obt('b', {
        gp_proximity: 2,
        train_station_proximity: 1,
        crime_per_1000: 2,
        rent_2br_flat: 1,
        english_class_proximity: 1,
      }),
      obt('c', {
        gp_proximity: 3,
        train_station_proximity: 2,
        crime_per_1000: 3,
        english_class_proximity: 2,
      }),
      obt('d', {
        gp_proximity: 4,
        train_station_proximity: 3,
        crime_per_1000: 4,
        english_class_proximity: 4,
      }),
    ],
  })
  const suburb = buildResults(mapData, 500).byId.get('a')!

  it('leaves crime out unless the household counted it', () => {
    const counted = new Set(['Affordability', 'Healthcare', 'Transport', 'Education'] as const)
    const { best, worst } = insights(mapData, suburb, new Set(counted), 'rent_2br_flat')
    const metrics = [...best, ...worst].map((item) => item.metric)
    expect(metrics).not.toContain('crime_per_1000')
    expect(best[0]?.metric).toBe('gp_proximity')
    expect(worst[0]?.metric).toBe('train_station_proximity')
  })

  it('only uses the rent for the home size they asked about', () => {
    const counted = new Set(['Affordability'] as const)
    const { best } = insights(mapData, suburb, new Set(counted), 'rent_2br_flat')
    expect(best.map((item) => item.metric)).toEqual(['rent_2br_flat'])
  })
})
