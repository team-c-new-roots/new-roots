import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, GraduationCap, School } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useFormat } from '@/composables/useFormat'
import { useLanguageName } from '@/composables/useLanguageName'
import { languageShare, metricValue, type SuburbResult } from '@/services/results'
import type { HomeLabel } from '@/types'
import type { MapData } from '@/types/scoring'

// the lines a card, the map panel and the summary all show for a suburb, so
// the three never disagree about what a figure says
export function useSuburbFacts() {
  const answers = useAnswersStore()
  const languageName = useLanguageName()
  const { t } = useI18n()
  const { money, km, percent, home } = useFormat()

  // the home the rent figures describe
  const rentHome = computed(() => answers.home.figures)

  // which school distances matter to this household (US 4.1)
  const schoolMetrics = computed(() => {
    switch (answers.schoolNeed) {
      case 'primary':
        return ['primary']
      case 'secondary':
        return ['secondary']
      case 'both':
        return ['primary', 'secondary']
      default:
        return []
    }
  })

  // Either names whichever home the suburb's rent is for, the cheaper one
  function homeFor(suburb: SuburbResult): HomeLabel {
    const type = suburb.row.selected_home
    return rentHome.value.type === 'either' && type ? { ...rentHome.value, type } : rentHome.value
  }

  // the rent figure's own column, for "does well" on the details page
  function rentMetricFor(suburb: SuburbResult): string {
    const type = suburb.row.selected_home
    return rentHome.value.type === 'either' && type
      ? `rent_${rentHome.value.bedrooms}br_${type}`
      : answers.home.rentMetric
  }

  function rentLine(suburb: SuburbResult): string | null {
    if (suburb.rent === null) return null
    return t('results.median', { home: home(homeFor(suburb)), amount: money(suburb.rent) })
  }

  // a suburb with no rent figure of its own gets its council area's median, or
  // failing that one from nearby suburbs. the data team asked for this to show
  function rentEstimate(suburb: SuburbResult): 'lga' | 'proximity' | null {
    if (suburb.rent === null) return null
    const method = suburb.obt?.[`${rentMetricFor(suburb)}_infilling_method`]
    return method === 'lga' || method === 'proximity' ? method : null
  }

  function estimateLine(suburb: SuburbResult): string | null {
    const estimate = rentEstimate(suburb)
    return estimate ? t(`results.estimate.${estimate}`) : null
  }

  function languageLine(suburb: SuburbResult, data: MapData): string | null {
    const census = answers.censusLanguage
    const language = languageName.value
    if (!census || !language) return null
    const share = languageShare(data, suburb.id, census)
    return share === null
      ? t('results.fewSpeakers', { language })
      : t('results.speakers', { language, percent: percent(share) })
  }

  function schoolLines(suburb: SuburbResult): string[] {
    return schoolMetrics.value.flatMap((level) => {
      const distance = metricValue(suburb.obt, `${level}_school_proximity`)
      return distance === null ? [] : [t(`results.${level}`, { distance: km(distance) })]
    })
  }

  function englishLine(suburb: SuburbResult): string | null {
    const distance = metricValue(suburb.obt, 'english_class_proximity')
    return distance === null ? null : t('results.englishClass', { distance: km(distance) })
  }

  // the same distances as separate pieces with an icon each, so a card can
  // show them as chips that wrap whole instead of breaking mid-figure
  function distanceFacts(suburb: SuburbResult): { key: string; text: string; icon: Component }[] {
    const facts = schoolMetrics.value.flatMap((level) => {
      const distance = metricValue(suburb.obt, `${level}_school_proximity`)
      if (distance === null) return []
      const icon = level === 'primary' ? School : GraduationCap
      return [{ key: level, text: t(`results.${level}`, { distance: km(distance) }), icon }]
    })
    const english = englishLine(suburb)
    if (english) facts.push({ key: 'english', text: english, icon: BookOpen })
    return facts
  }

  return {
    rentHome,
    schoolMetrics,
    homeFor,
    rentMetricFor,
    rentLine,
    rentEstimate,
    estimateLine,
    languageLine,
    schoolLines,
    englishLine,
    distanceFacts,
  }
}
