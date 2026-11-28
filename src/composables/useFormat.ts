import { useI18n } from 'vue-i18n'
import type { HomeLabel, HomeType } from '@/types'

// Dari and Farsi would default to the Persian calendar and digits, so dates
// stay Gregorian with Western digits to match leases and Centrelink letters.
// read as UTC so no time zone moves the day
const AUSTRALIAN = { calendar: 'gregory', numberingSystem: 'latn', timeZone: 'UTC' } as const

// number and label formatting in the current language, so a translation gets
// its own digits and units without any component changing
export function useFormat() {
  const { t, n, locale } = useI18n()

  const money = (value: number) => n(value, 'currency')
  const cents = (value: number) => n(value, 'cents')
  // a no-break space before the unit, so km never wraps onto its own line
  const km = (value: number) => n(value, 'km').replace(/\s(?=\D+$)/u, '\u00a0')
  // metres to the nearest 50 under 1 km, so 0.34 reads as 350 m, not 0.3 km
  const distance = (value: number) =>
    value < 0.975
      ? n(Math.max(50, Math.round((value * 1000) / 50) * 50), 'metres').replace(
          /\s(?=\D+$)/u,
          '\u00a0',
        )
      : km(value)
  // the data stores percents as 9 for 9%, Intl wants 0.09
  const percent = (value: number) => n(value / 100, 'percent')
  const decimal = (value: number) => n(value, 'decimal')
  const whole = (value: number) => n(value, 'whole')

  // 2026-11-15 to 15 November 2026, same UTC reading
  function fullDate(iso: string) {
    const date = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return iso
    return new Intl.DateTimeFormat(locale.value, {
      ...AUSTRALIAN,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  // 2026-09-20 to September 2026. read as UTC so no time zone moves the month
  function monthYear(iso: string) {
    const date = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return iso
    return new Intl.DateTimeFormat(locale.value, {
      ...AUSTRALIAN,
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  // just the year, for chart ticks
  function year(iso: string) {
    const date = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return iso
    return new Intl.DateTimeFormat(locale.value, { ...AUSTRALIAN, year: 'numeric' }).format(date)
  }

  // 5 or more has its own wording, since "5+-bed house" reads like a typo
  function home(label: HomeLabel | { type: HomeType; bedrooms: number }) {
    if (label.bedrooms >= 5) return t(`homes.fivePlus.${label.type}`)
    return t(`homes.${label.type}`, { beds: String(label.bedrooms) })
  }

  return { money, cents, km, distance, percent, decimal, whole, monthYear, year, fullDate, home }
}
