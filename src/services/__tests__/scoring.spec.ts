import { describe, expect, it } from 'vitest'
import type {
  AppData,
  LanguageFile,
  LanguageIndexEntry,
  ObtRow,
  ScoreRequest,
} from '@/types/scoring'
import { affordabilityCap, scoreSuburbs, toScoreRequest } from '../scoring'
import appData from '../../../public/data/app-data.json'
import languageIndex from '../../../public/data/languages/index.json'
import parity from './fixtures/scoring-parity.json'

const data = appData as unknown as AppData

// the exported language files, read the way the app finds them, through the index
const files = import.meta.glob<LanguageFile>('../../../public/data/languages/*.json', {
  eager: true,
  import: 'default',
})
function languageFile(name: string): LanguageFile {
  const entry = (languageIndex as LanguageIndexEntry[]).find((item) => item.name === name)!
  return files[`../../../public/data/languages/${entry.file}.json`]!
}

const OUTPUTS = [
  'affordability_score',
  'education_score',
  'healthcare_score',
  'safety_score',
  'transport_score',
  'language_score',
  'community_score',
  'selected_weekly_rent',
  'rent_to_income_pct',
  'affordability_cap',
  'overall_score',
] as const

/* the fixture is the data team's own scoring module run on three households
   (scripts/make_parity_fixture.py), for suburbs with every figure present.
   for those suburbs the browser has to give the same answers to the cent */
describe('matches the scoring module', () => {
  for (const { household, expected } of parity.cases) {
    const request = household as ScoreRequest

    it(`${household.selected_language}, ${household.bedrooms}-bed ${household.dwelling_type}, $${household.income} a week`, () => {
      const language = languageFile(request.selected_language!)
      const rows = new Map(scoreSuburbs(data, language, request).map((row) => [row.suburb_id, row]))
      // every figure that differs by more than half a cent, so a failure lists them all
      const differences: string[] = []
      for (const [id, values] of Object.entries(expected)) {
        const row = rows.get(id)
        for (const key of OUTPUTS) {
          const want = (values as Record<string, number | null>)[key] ?? null
          const got = row?.[key] ?? null
          const same = want === null ? got === null : got !== null && Math.abs(got - want) < 0.005
          if (!same) differences.push(`${id} ${key}: module ${want}, browser ${got}`)
        }
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
      english_class_proximity_score: 90,
      primary_school_proximity_score: 50,
    }),
    suburb('no-house', {
      rent_2br_flat_value: 400,
      rent_2br_flat_score: 80,
      rent_2br_house_value: null,
      rent_2br_house_score: null,
      english_class_proximity_score: 90,
      primary_school_proximity_score: null,
    }),
    suburb('no-rent', {
      rent_2br_flat_value: null,
      rent_2br_flat_score: null,
      rent_2br_house_value: null,
      rent_2br_house_score: null,
      english_class_proximity_score: 70,
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
    Safety: 'not important',
    Transport: 'important',
    Language: 'important',
    Community: 'important',
  },
}

describe('missing figures are left out, not counted as 0', () => {
  const rows = new Map(scoreSuburbs(tiny, dari, request).map((row) => [row.suburb_id, row]))

  it('averages only the rents that exist, so a missing house rent doesn’t halve the flat rent', () => {
    expect(rows.get('no-house')?.selected_weekly_rent).toBe(400)
    expect(rows.get('full')?.selected_weekly_rent).toBe(450)
  })

  it('reweights a topic from the figures that are there', () => {
    // english class only, rather than (90 x 60 + 0 x 40) / 100
    expect(rows.get('no-house')?.education_score).toBe(90)
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
    // budget fit 2 x ((80 + 60) / 2) and education 1 x 74 and language 1 x 100, over 4
    expect(rows.get('full')?.overall_score).toBe(Math.round(((2 * 70 + 74 + 100) / 4) * 100) / 100)
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
        Transport: 'not',
        Language: 'very',
        Community: 'important',
        Safety: 'not',
      },
      incomeWeekly: 700,
      home: { bedrooms: 1, dwelling_type: 'flat' },
    })
    expect(sent.topic_importance.Affordability).toBe('very important')
    expect(sent.topic_importance.Language).toBe('not important')
    expect(sent.topic_importance.Education).toBe('very important')
  })

  it('ranks all 572 suburbs from the real data in well under a frame', () => {
    const start = performance.now()
    const household = parity.cases[0]!.household as ScoreRequest
    const rows = scoreSuburbs(data, languageFile(household.selected_language!), household)
    expect(rows).toHaveLength(data.suburbs.length)
    expect(performance.now() - start).toBeLessThan(50)
  })
})
