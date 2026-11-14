import { createI18n } from 'vue-i18n'
import en from './en'

export type MessageSchema = typeof en

// only English has words so far. Dari, Farsi, Arabic, Pashto and Dinka join
// this list in iteration 2, once a fluent speaker has reviewed each file
const messages = { 'en-AU': en }

export const TRANSLATED = Object.keys(messages)

export const i18n = createI18n({
  legacy: false,
  locale: 'en-AU',
  fallbackLocale: 'en-AU',
  messages,
  numberFormats: {
    'en-AU': {
      currency: {
        style: 'currency',
        currency: 'AUD',
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 0,
      },
      percent: { style: 'percent', maximumFractionDigits: 1 },
      km: { style: 'unit', unit: 'kilometer', unitDisplay: 'short', maximumFractionDigits: 1 },
      decimal: { maximumFractionDigits: 1 },
      whole: { maximumFractionDigits: 0 },
    },
  },
  datetimeFormats: {
    'en-AU': {
      long: { year: 'numeric', month: 'long', day: 'numeric' },
    },
  },
})

export function isTranslated(code: string): boolean {
  return TRANSLATED.includes(code)
}

// switches the words and tells the browser and screen readers which language
// and direction the page is in. called with the language someone picked when
// it's translated, otherwise English
export function applyLocale(code: string, dir: 'ltr' | 'rtl') {
  if (!isTranslated(code)) return
  i18n.global.locale.value = code as typeof i18n.global.locale.value
  document.documentElement.lang = code
  document.documentElement.dir = dir
}
