import { createI18n } from 'vue-i18n'
import en from './en'
import { APP_LANGUAGES } from '@/data/languages'

export type MessageSchema = typeof en

// English ships with the app. every other language is a machine translated
// file in ./locales, downloaded only when someone picks it, so the first page
// stays small. a message missing from one shows in English
const files = import.meta.glob<{ default: MessageSchema }>('./locales/*.json')
const fileFor = (code: string) => `./locales/${code}.json`

// every language uses Western digits and the Australian formats, so amounts
// match what people type and what's on their lease and Centrelink letters
const latn = { numberingSystem: 'latn' } as const
const numbers = {
  currency: {
    ...latn,
    style: 'currency',
    currency: 'AUD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  },
  // the budget breakdown adds up to the cent, so it shows them
  cents: {
    ...latn,
    style: 'currency',
    currency: 'AUD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  percent: { ...latn, style: 'percent', maximumFractionDigits: 1 },
  km: {
    ...latn,
    style: 'unit',
    unit: 'kilometer',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  },
  decimal: { ...latn, maximumFractionDigits: 1 },
  whole: { ...latn, maximumFractionDigits: 0 },
} as const

// the date on the summary, Gregorian for the same reason
const dates = {
  long: { ...latn, calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric' },
} as const

export const i18n = createI18n({
  legacy: false,
  locale: 'en-AU',
  fallbackLocale: 'en-AU',
  messages: { 'en-AU': en },
  numberFormats: Object.fromEntries(APP_LANGUAGES.map((language) => [language.code, numbers])),
  datetimeFormats: Object.fromEntries(APP_LANGUAGES.map((language) => [language.code, dates])),
})

export function isTranslated(code: string): boolean {
  return code === 'en-AU' || fileFor(code) in files
}

// switches the words and tells the browser and screen readers which language
// and direction the page is in. called with the language someone picked when
// it's translated, otherwise English
let latest = 'en-AU'

export async function applyLocale(code: string, dir: 'ltr' | 'rtl') {
  if (!isTranslated(code)) return
  latest = code
  const global = i18n.global
  if (!global.availableLocales.includes(code as 'en-AU')) {
    const file = await files[fileFor(code)]!()
    // the typed locale list only knows en-AU, the rest arrive at runtime
    global.setLocaleMessage(code as 'en-AU', file.default)
  }
  // someone tapped another language while this one downloaded
  if (latest !== code) return
  global.locale.value = code as 'en-AU'
  document.documentElement.lang = code
  document.documentElement.dir = dir
}
