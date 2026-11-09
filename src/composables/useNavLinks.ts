import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import { useAnswersStore } from '@/stores/answers'

export interface NavLink {
  key: string
  to: RouteLocationRaw
  label: string
  // shown in the desktop header as well as the menu
  inHeader: boolean
}

// one list for the menu panel and the desktop header, so the two can't drift.
// once there's a budget, Find suburbs becomes Your suburbs and goes straight there
export function useNavLinks() {
  const { t } = useI18n()
  const answers = useAnswersStore()

  return computed<NavLink[]>(() => [
    { key: 'start', to: { name: 'intro' }, label: t('nav.start'), inHeader: false },
    answers.incomeDone
      ? { key: 'results', to: { name: 'results' }, label: t('nav.results'), inHeader: true }
      : { key: 'find', to: { name: 'household' }, label: t('nav.findSuburbs'), inHeader: true },
    ...(answers.incomeDone
      ? [{ key: 'summary', to: { name: 'summary' }, label: t('nav.summary'), inHeader: false }]
      : []),
    { key: 'support', to: { name: 'support' }, label: t('nav.support'), inHeader: true },
    { key: 'how', to: { name: 'how-it-works' }, label: t('nav.howItWorks'), inHeader: true },
    { key: 'privacy', to: { name: 'privacy' }, label: t('nav.privacy'), inHeader: true },
  ])
}
