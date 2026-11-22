import { describe, expect, it } from 'vitest'
import en from '../en'
import {
  checkTranslation,
  fingerprint,
  flatten,
  outOfDate,
  unflatten,
  type Messages,
} from '../checks'
import { APP_LANGUAGES } from '@/data/languages'

const english = en as Messages
const locales = import.meta.glob<{ default: Messages }>('../locales/*.json', { eager: true })
const stamps = import.meta.glob<{ default: Record<string, string> }>('../stamps/*.json', {
  eager: true,
})

const codeOf = (path: string) => path.split('/').pop()!.replace('.json', '')
const byCode = <T>(files: Record<string, { default: T }>) =>
  Object.fromEntries(Object.entries(files).map(([path, file]) => [codeOf(path), file.default]))

const localeFiles = byCode(locales)
const stampFiles = byCode(stamps)

describe('translation checks', () => {
  it('flattens and rebuilds the same messages', () => {
    expect(unflatten(flatten(english))).toEqual(english)
  })

  it('passes a translation that keeps everything', () => {
    const good = { income: { budgetValue: 'Environ {amount} par semaine' } }
    expect(checkTranslation(english, good)).toEqual([])
  })

  it('catches what would break the app', () => {
    const bad = {
      income: { budgetValue: 'Environ {montant} par semaine' },
      units: { adults: '{n} adulte | {n} adultes | {n} beaucoup' },
      app: { name: 'New Roots @ Melbourne', home: ' ' },
      madeUp: { key: 'Bonjour' },
    }
    const problems = checkTranslation(english, bad).join('\n')
    expect(problems).toContain("income.budgetValue: placeholders don't match")
    expect(problems).toContain("units.adults: plural forms don't match")
    expect(problems).toContain('app.name: has vue-i18n syntax in it')
    expect(problems).toContain('app.home: is empty')
    expect(problems).toContain("madeUp.key: isn't in en.ts")
  })

  it('gives the same fingerprint for the same English only', () => {
    expect(fingerprint('Next')).toBe(fingerprint('Next'))
    expect(fingerprint('Next')).not.toBe(fingerprint('Next '))
    expect(fingerprint('Next')).toMatch(/^[0-9a-f]{8}$/)
  })

  it('spots English that changed or is new since a translation', () => {
    const source = { steps: { next: 'Next', back: 'Go back', done: 'Done' } }
    const translated = { steps: { next: 'Suivant', back: 'Retour' } }
    const stamped = { 'steps.next': fingerprint('Next'), 'steps.back': fingerprint('Back') }
    expect(outOfDate(source, translated, stamped)).toEqual({
      missing: ['steps.done'],
      stale: ['steps.back'],
    })
  })
})

describe('languages', () => {
  it('has an English name for every language', () => {
    const names = flatten(english)
    const broken = APP_LANGUAGES.filter((language) => !names[language.nameKey])
    expect(broken.map((language) => language.code)).toEqual([])
  })

  it('keeps an even number in each list, so two columns line up', () => {
    for (const group of ['main', 'more']) {
      const count = APP_LANGUAGES.filter((language) => language.group === group).length
      expect(count % 2).toBe(0)
    }
  })

  it('has a translation file for every language but English', () => {
    const missing = APP_LANGUAGES.filter(
      (language) => language.code !== 'en-AU' && !localeFiles[language.code],
    )
    expect(missing.map((language) => language.code)).toEqual([])
  })

  it('only has translation files for languages in the app, each with nothing broken', () => {
    const codes = new Set<string>(APP_LANGUAGES.map((language) => language.code))
    const problems: string[] = []
    for (const [code, file] of Object.entries(localeFiles)) {
      if (!codes.has(code)) problems.push(`${code}: not a language in the app`)
      problems.push(...checkTranslation(english, file).map((problem) => `${code} ${problem}`))
    }
    expect(problems).toEqual([])
  })

  // fails after any change to en.ts until each language is redone. redo the
  // listed keys in src/i18n/locales/<code>.json, then npm run i18n:stamp
  it('keeps every translation up to date with en.ts', () => {
    const report: string[] = []
    for (const [code, file] of Object.entries(localeFiles)) {
      const { missing, stale } = outOfDate(english, file, stampFiles[code] ?? {})
      if (missing.length) report.push(`${code} not translated yet: ${missing.join(', ')}`)
      if (stale.length) report.push(`${code} English changed since: ${stale.join(', ')}`)
    }
    expect(report).toEqual([])
  })
})
