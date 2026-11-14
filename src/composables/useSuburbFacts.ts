import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, GraduationCap, School } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useFormat } from '@/composables/useFormat'
import { languageShare, metricValue, type SuburbResult } from '@/services/results'
import { EXAMPLE_HOME, usingExample } from '@/services/api'
import type { HomeLabel } from '@/types'
import type { MapData } from '@/types/api'

// the lines a card, the map panel and the summary all show for a suburb, so
// the three never disagree about what a figure says
export function useSuburbFacts() {
  const answers = useAnswersStore()
  const { t } = useI18n()
  const { money, km, percent, home } = useFormat()

  // the home the rent figures describe
  const rentHome = computed<HomeLabel>(() =>
    usingExample ? { ...EXAMPLE_HOME } : answers.home.figures,
  )

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

  function rentLine(suburb: SuburbResult): string | null {
    if (suburb.rent === null) return null
    return t('results.median', { home: home(rentHome.value), amount: money(suburb.rent) })
  }

  function languageLine(suburb: SuburbResult, data: MapData): string | null {
    const key = answers.rankingLanguage
    const census = answers.censusLanguage
    if (!key || !census) return null
    const language = t(`languages.${key}`)
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
    rentLine,
    languageLine,
    schoolLines,
    englishLine,
    distanceFacts,
  }
}
