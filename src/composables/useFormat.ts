import { useI18n } from 'vue-i18n'
import type { HomeLabel, HomeType } from '@/types'

// number and label formatting in the current language, so a translation gets
// its own digits and units without any component changing
export function useFormat() {
  const { t, n } = useI18n()

  const money = (value: number) => n(value, 'currency')
  const km = (value: number) => n(value, 'km')
  // the data stores percents as 9 for 9%, Intl wants 0.09
  const percent = (value: number) => n(value / 100, 'percent')
  const decimal = (value: number) => n(value, 'decimal')
  const whole = (value: number) => n(value, 'whole')

  function home(label: HomeLabel | { type: HomeType; bedrooms: number }) {
    const beds = label.bedrooms >= 5 ? '5+' : String(label.bedrooms)
    return t(`homes.${label.type}`, { beds })
  }

  return { money, km, percent, decimal, whole, home }
}
