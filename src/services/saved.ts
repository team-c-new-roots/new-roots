import type {
  AdultIncome,
  AdultPayment,
  HomeType,
  Importance,
  IncomeSource,
  PayPeriod,
  RatedTopic,
  SchoolNeed,
  YesNo,
} from '@/types'
import { MAX_ADULTS, MAX_BEDROOMS, MAX_CHILDREN } from '@/services/household'
import { MAX_PLACES } from '@/services/travel'
import { DEFAULT_IMPORTANCE } from '@/data/topics'

/* US 2.7, saving on this device. off until someone chooses it, because on a
   shared phone the next person would see the last one's answers. when it's
   on, the answers and the summary list go in localStorage under one key and
   nothing is sent anywhere. Clear my details or tapping Save again removes it.

   whatever comes back out is checked field by field, since anything on the
   page could have written to it. a field that doesn't look right falls back
   to its default rather than breaking the app */

export const SAVED_KEY = 'new-roots-saved'
const VERSION = 1
// gone a month after the last visit, so an old phone doesn't keep it forever
export const KEEP_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
// suburb ids are numbers as strings. anything else isn't ours
const ID = /^\d{1,8}$/
const MAX_TEXT = 80
// summary limit, kept here so this file doesn't import the store
const MAX_SHORTLIST = 5

export interface SavedAnswers {
  adults: number
  children: number
  chosenBedrooms: number | null
  homeType: HomeType
  incomeSource: IncomeSource | null
  incomes: AdultIncome[]
  familyTax: YesNo | null
  wageAmount: number | null
  wagePeriod: PayPeriod
  couple: YesNo | null
  teens: number
  youngestUnderFive: YesNo | null
  communityLanguage: string | null
  communityLanguageLabel: string | null
  importance: Record<RatedTopic, Importance>
  places: string[]
  chosenSchoolNeed: SchoolNeed | null
  shortlist: string[] | null
}

export interface SavedState {
  answers: SavedAnswers
  language: string
  theme: string
  mapContrast: boolean
}

interface Stored extends SavedState {
  v: number
  at: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
  return options.includes(value as T) ? (value as T) : null
}

function whole(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null
}

function amount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000
    ? value
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT ? value : null
}

function ids(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  if (!value.every((item) => typeof item === 'string' && ID.test(item))) return null
  return [...new Set(value as string[])]
}

const YES_NO = ['yes', 'no'] as const
const PAYMENTS: AdultPayment[] = ['jobseeker', 'parenting', 'other', 'none']
const IMPORTANCE: Importance[] = ['not', 'important', 'very']

function income(value: unknown): AdultIncome {
  if (!isRecord(value)) return { payment: null, otherFortnight: null }
  return { payment: oneOf(value.payment, PAYMENTS), otherFortnight: amount(value.otherFortnight) }
}

// the answers from storage, with anything odd swapped for its default
export function cleanAnswers(raw: unknown): SavedAnswers {
  const value = isRecord(raw) ? raw : {}
  const adults = whole(value.adults, 1, MAX_ADULTS) ?? 1
  const importance = { ...DEFAULT_IMPORTANCE }
  if (isRecord(value.importance)) {
    for (const topic of Object.keys(DEFAULT_IMPORTANCE) as RatedTopic[]) {
      importance[topic] = oneOf(value.importance[topic], IMPORTANCE) ?? importance[topic]
    }
  }
  const incomes = Array.isArray(value.incomes) ? value.incomes.slice(0, adults).map(income) : []
  return {
    adults,
    children: whole(value.children, 0, MAX_CHILDREN) ?? 0,
    chosenBedrooms: whole(value.chosenBedrooms, 1, MAX_BEDROOMS),
    homeType: oneOf(value.homeType, ['house', 'flat', 'either'] as const) ?? 'either',
    incomeSource: oneOf(value.incomeSource, ['payments', 'work', 'both'] as const),
    incomes,
    familyTax: oneOf(value.familyTax, YES_NO),
    wageAmount: amount(value.wageAmount),
    wagePeriod: oneOf(value.wagePeriod, ['week', 'fortnight', 'month'] as const) ?? 'week',
    couple: oneOf(value.couple, YES_NO),
    teens: whole(value.teens, 0, MAX_CHILDREN) ?? 0,
    youngestUnderFive: oneOf(value.youngestUnderFive, YES_NO),
    communityLanguage: text(value.communityLanguage),
    communityLanguageLabel: text(value.communityLanguageLabel),
    importance,
    places: ids(value.places, MAX_PLACES) ?? [],
    chosenSchoolNeed: oneOf(value.chosenSchoolNeed, [
      'primary',
      'secondary',
      'both',
      'none',
    ] as const),
    shortlist: value.shortlist === null ? null : ids(value.shortlist, MAX_SHORTLIST),
  }
}

// some browsers block storage outright, private Safari used to throw on write
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

// what's saved, or null if nothing is, it's from another version, it's past
// KEEP_DAYS or it doesn't parse. anything unusable is removed on the way
export function readSaved(now = Date.now()): SavedState | null {
  const store = storage()
  if (!store) return null
  let raw: unknown
  try {
    const item = store.getItem(SAVED_KEY)
    if (item === null) return null
    raw = JSON.parse(item)
  } catch {
    removeSaved()
    return null
  }
  if (
    !isRecord(raw) ||
    raw.v !== VERSION ||
    typeof raw.at !== 'number' ||
    now - raw.at > KEEP_DAYS * DAY_MS
  ) {
    removeSaved()
    return null
  }
  return {
    answers: cleanAnswers(raw.answers),
    language: text(raw.language) ?? 'en-AU',
    theme: text(raw.theme) ?? 'default',
    mapContrast: raw.mapContrast === true,
  }
}

// false when the browser won't let us, so the button can say so
export function writeSaved(state: SavedState, now = Date.now()): boolean {
  const store = storage()
  if (!store) return false
  const stored: Stored = { v: VERSION, at: now, ...state }
  try {
    store.setItem(SAVED_KEY, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

export function removeSaved() {
  try {
    storage()?.removeItem(SAVED_KEY)
  } catch {
    // nothing to remove if storage is blocked
  }
}
