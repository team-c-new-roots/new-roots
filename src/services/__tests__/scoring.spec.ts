import { describe, expect, it } from 'vitest'
import type {
  AppData,
  LanguageFile,
  LanguageIndexEntry,
  ObtRow,
  ResultRow,
  ScoreRequest,
} from '@/types/scoring'
import { affordabilityCap, scoreSuburbs, toScoreRequest } from '../scoring'
import appData from '../../../public/data/app-data.json'
import languageIndex from '../../../public/data/languages/index.json'
import parity from './fixtures/scoring-parity.json'

/* the export swaps a few rents for the council figure (scripts/rent_outliers.py)
   that Gold doesn't, so put Gold's own figures back first. the test is that the
   browser scores like the module given the same figures */
function asGold(exported: AppData): AppData {
  const suburbs = exported.suburbs.map((row) => ({ ...row }))
  const byId = new Map(suburbs.map((row) => [row.suburb_id, row]))
  for (const swap of exported.rentOverrides ?? []) {
    const row = byId.get(swap.suburb_id)!
    Object.assign(row, {
      [`rent_${swap.home}_value`]: swap.own,
      [`rent_${swap.home}_score`]: swap.ownScore,
      [`rent_${swap.home}_ranking`]: swap.ownRanking,
      [`rent_${swap.home}_infilling_method`]: 'suburb',
    })
  }
  return { ...exported, suburbs }
}

const data = asGold(appData as unknown as AppData)

// the exported language files, read the way the app finds them, through the index
const files = import.meta.glob<LanguageFile>('../../../public/data/languages/*.json', {
  eager: true,
  import: 'default',
})
function languageFile(name: string): LanguageFile {
  const entry = (languageIndex as LanguageIndexEntry[]).find((item) => item.name === name)!
  return files[`../../../public/data/languages/${entry.file}.json`]!
}

/* the fixture is the data team's own scoring module run on five households
   (scripts/make_parity_fixture.py), with every output for every suburb. the
   browser has to give the same answers to the cent, and rank in the same
   order. the module marks a score it can't work out as -1, where the browser
   uses null */
const fixture = parity as unknown as {
  outputs: string[]
  cases: { household: ScoreRequest; expected: Record<string, (number | string | null)[]> }[]
}

function browserValue(row: ResultRow | undefined, key: string): number | string | null {
  if (key === 'selected_dwelling_type') return row?.selected_home ?? null
  return (row?.[key as keyof ResultRow] as number | string | null | undefined) ?? null
}

describe('matches the scoring module for every suburb', () => {
  for (const { household: made, expected } of fixture.cases) {
    // the fixture was made before nearby services (US 4.3) was a topic. at
    // not important it carries no weight, so everything else has to match
    const household: ScoreRequest = {
      ...made,
      topic_importance: { ...made.topic_importance, Essentials: 'not important' },
    }
    it(`${household.selected_language}, ${household.bedrooms}-bed ${household.dwelling_type}, $${household.income} a week`, () => {
      const language = languageFile(household.selected_language!)
      const rows = new Map(
        scoreSuburbs(data, language, household).map((row) => [row.suburb_id, row]),
      )
      expect(Object.keys(expected)).toHaveLength(data.suburbs.length)
      // every figure that differs by more than half a cent, so a failure lists them all
      const differences: string[] = []
      for (const [id, values] of Object.entries(expected)) {
        const row = rows.get(id)
        fixture.outputs.forEach((key, index) => {
          let want = values[index] ?? null
          if (want === -1 && key.endsWith('_score')) want = null
          const got = browserValue(row, key)
          const same =
            typeof want === 'number'
              ? typeof got === 'number' && Math.abs(got - want) < 0.005
              : got === want
          if (!same) differences.push(`${id} ${key}: module ${want}, browser ${got}`)
        })
      }
      expect(differences).toEqual([])
    })
  }
})

// a small made-up data set for the cases the fixture can't cover
function suburb(id: string, figures: Record<string, number | null>): ObtRow {
  return { suburb_id: id, suburb_name: `Suburb ${id}`, suburb_area_km2: 4, ...figures }
}

const tiny: AppData = {
  exported: 'test',
  weights: [
    { topic: 'Affordability', table: 'obt', metric: 'rent_2br_flat', weight: 50 },
    { topic: 'Affordability', table: 'obt', metric: 'rent_2br_house', weight: 50 },
    { topic: 'Education', table: 'obt', metric: 'english_class_proximity', weight: 60 },
    { topic: 'Education', table: 'obt', metric: 'primary_school_proximity', weight: 40 },
    { topic: 'Language', table: 'languages', metric: 'language', weight: 100 },
  ],
  suburbs: [
    suburb('full', {
      rent_2br_flat_value: 400,
      rent_2br_flat_score: 80,
      rent_2br_house_value: 500,
      rent_2br_house_score: 60,
      english_class_proximity_value: 1.2,
      english_class_proximity_score: 90,
      primary_school_proximity_value: 2.5,
      primary_school_proximity_score: 50,
    }),
    suburb('no-house', {
      rent_2br_flat_value: 400,
      rent_2br_flat_score: 80,
      rent_2br_house_value: null,
      rent_2br_house_score: null,
      english_class_proximity_value: 1.2,
      english_class_proximity_score: 90,
      primary_school_proximity_value: null,
      primary_school_proximity_score: null,
    }),
    suburb('no-rent', {
      rent_2br_flat_value: null,
      rent_2br_flat_score: null,
      rent_2br_house_value: null,
      rent_2br_house_score: null,
      english_class_proximity_value: 3,
      english_class_proximity_score: 70,
      primary_school_proximity_value: 3,
      primary_school_proximity_score: 70,
    }),
  ],
  topLanguages: {},
  languageLabels: {},
  community: {},
}

// percent, speaker count, then the language score. no-rent's figures are blank,
// the way Gold has a few suburbs with no language figures at all
const dari: LanguageFile = {
  name: 'Dari',
  label: 'Dari',
  metrics: ['language'],
  suburbs: { full: [5, 200, 100], 'no-house': [1, 40, 40], 'no-rent': [null, null, null] },
}

const request: ScoreRequest = {
  selected_language: 'Dari',
  bedrooms: 2,
  dwelling_type: 'both',
  income: 2000,
  topic_importance: {
    Affordability: 'very important',
    Education: 'important',
    Healthcare: 'important',
    Essentials: 'important',
    Safety: 'not important',
    Transport: 'important',
    Language: 'important',
    Community: 'important',
  },
}

describe('missing figures are left out, not counted as 0', () => {
  const rows = new Map(scoreSuburbs(tiny, dari, request).map((row) => [row.suburb_id, row]))

  it('uses the cheaper of the flat and house rent for Either, and says which', () => {
    expect(rows.get('full')?.selected_weekly_rent).toBe(400)
    expect(rows.get('full')?.selected_home).toBe('flat')
    // a missing house rent just means the flat is the only one to go on
    expect(rows.get('no-house')?.selected_weekly_rent).toBe(400)
  })

  it('picks the house where that’s the cheaper one', () => {
    const cheapHouse: AppData = {
      ...tiny,
      suburbs: [
        suburb('house', {
          rent_2br_flat_value: 520,
          rent_2br_flat_score: 55,
          rent_2br_house_value: 470,
          rent_2br_house_score: 65,
        }),
      ],
    }
    const [row] = scoreSuburbs(cheapHouse, null, { ...request, selected_language: null })
    expect(row?.selected_home).toBe('house')
    expect(row?.selected_weekly_rent).toBe(470)
    expect(row?.affordability_score).toBe(65)
  })

  it('reweights a topic from the figures that are there', () => {
    // english class only, rather than (90 x 60 + 0 x 40) / 100
    expect(rows.get('no-house')?.education_score).toBe(90)
  })

  it('counts a figure of 0, and leaves out a blank one', () => {
    const zero: AppData = {
      ...tiny,
      suburbs: [
        suburb('zero', {
          english_class_proximity_value: 1.2,
          english_class_proximity_score: 90,
          primary_school_proximity_value: 0,
          primary_school_proximity_score: 50,
        }),
      ],
    }
    const [row] = scoreSuburbs(zero, null, { ...request, selected_language: null })
    // a school 0 km away is a real distance, so (90 x 60 + 50 x 40) / 100
    expect(row?.education_score).toBe(74)
  })

  it('gives no budget fit at all when there is no rent figure', () => {
    const row = rows.get('no-rent')!
    expect(row.affordability_score).toBeNull()
    expect(row.selected_weekly_rent).toBeNull()
    expect(row.rent_to_income_pct).toBeNull()
    // the overall comes from the topics it does have
    expect(row.overall_score).toBe(70)
  })

  it('ignores healthcare, transport and community, which this data set has nothing for', () => {
    // budget fit 2 x 80 for the cheaper flat, education 1 x 74 and language 1 x 100, over 4
    expect(rows.get('full')?.overall_score).toBe(Math.round(((2 * 80 + 74 + 100) / 4) * 100) / 100)
  })
})

describe('language files', () => {
  it('reads a suburb missing from the file as nobody speaking it, a score of 0', () => {
    const sparse: LanguageFile = { ...dari, suburbs: { full: [5, 200, 100] } }
    const rows = new Map(scoreSuburbs(tiny, sparse, request).map((row) => [row.suburb_id, row]))
    expect(rows.get('no-house')?.language_score).toBe(0)
    expect(rows.get('full')?.language_score).toBe(100)
  })

  it('leaves language out entirely when the household has none', () => {
    const rows = scoreSuburbs(tiny, null, { ...request, selected_language: null })
    expect(rows.every((row) => row.language_score === null)).toBe(true)
  })
})

describe('the rest of the rules', () => {
  it('caps budget fit by rent as a share of income, in the same steps', () => {
    expect(affordabilityCap(0.2)).toBe(100)
    expect(affordabilityCap(0.3)).toBe(85)
    expect(affordabilityCap(0.31)).toBe(30)
    expect(affordabilityCap(0.6)).toBe(0)
  })

  it('ranks best first and numbers every suburb', () => {
    const rows = scoreSuburbs(tiny, dari, request)
    expect(rows.map((row) => row.overall_rank)).toEqual([1, 2, 3])
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.overall_score!).toBeGreaterThanOrEqual(rows[i]!.overall_score!)
    }
  })

  it('sends affordability as always counting most, and drops language without one (US 2.2)', () => {
    const sent = toScoreRequest({
      censusLanguage: null,
      importance: {
        Education: 'very',
        Healthcare: 'important',
        Essentials: 'important',
        Commute: 'important',
        Transport: 'not',
        Language: 'very',
        Community: 'important',
        Safety: 'not',
      },
      incomeWeekly: 700,
      home: { bedrooms: 1, dwelling_type: 'flat' },
      places: [],
    })
    expect(sent.topic_importance.Affordability).toBe('very important')
    expect(sent.topic_importance.Language).toBe('not important')
    expect(sent.topic_importance.Education).toBe('very important')
    // no place to get to, so travel time isn't sent at all (US 4.2)
    expect(sent.topic_importance.Commute).toBeUndefined()
    expect(sent.key_places).toBeUndefined()
  })

  it('ranks all 572 suburbs from the real data in well under a frame', () => {
    const start = performance.now()
    const household = fixture.cases[0]!.household
    const rows = scoreSuburbs(data, languageFile(household.selected_language!), household)
    expect(rows).toHaveLength(data.suburbs.length)
    expect(performance.now() - start).toBeLessThan(50)
  })
})
