import { useI18n } from 'vue-i18n'
import type { HomeLabel, HomeType } from '@/types'

// number and label formatting in the current language, so a translation gets
// its own digits and units without any component changing
export function useFormat() {
  const { t, n, locale } = useI18n()

  const money = (value: number) => n(value, 'currency')
  const km = (value: number) => n(value, 'km')
  // the data stores percents as 9 for 9%, Intl wants 0.09
  const percent = (value: number) => n(value / 100, 'percent')
  const decimal = (value: number) => n(value, 'decimal')
  const whole = (value: number) => n(value, 'whole')

  // 2026-09-20 to September 2026. read as UTC so no time zone moves the month
  function monthYear(iso: string) {
    const date = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return iso
    return new Intl.DateTimeFormat(locale.value, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  }

  function home(label: HomeLabel | { type: HomeType; bedrooms: number }) {
    const beds = label.bedrooms >= 5 ? '5+' : String(label.bedrooms)
    return t(`homes.${label.type}`, { beds })
  }

  return { money, km, percent, decimal, whole, monthYear, home }
}
