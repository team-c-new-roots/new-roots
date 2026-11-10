import { nextTick } from 'vue'
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { i18n } from '@/i18n'
import { useAnnouncer } from '@/composables/useAnnouncer'
import { useAnswersStore } from '@/stores/answers'
import LanguageView from '@/views/LanguageView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    // i18n key for the page title
    titleKey: string
    // anything past the income step needs a budget to make sense
    needsBudget?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // the language screen is the only eager one, everything else loads when visited
    {
      path: '/',
      name: 'language',
      component: LanguageView,
      meta: { titleKey: 'languagePage.title' },
    },
    {
      path: '/welcome',
      name: 'intro',
      component: () => import('@/views/IntroView.vue'),
      meta: { titleKey: 'intro.title' },
    },
    {
      path: '/step/household',
      name: 'household',
      component: () => import('@/views/HouseholdStep.vue'),
      meta: { titleKey: 'household.title' },
    },
    {
      path: '/step/income',
      name: 'income',
      component: () => import('@/views/IncomeStep.vue'),
      meta: { titleKey: 'income.title' },
    },
    {
      path: '/step/language',
      name: 'community-language',
      component: () => import('@/views/CommunityLanguageStep.vue'),
      meta: { titleKey: 'communityLanguage.title', needsBudget: true },
    },
    {
      path: '/step/community',
      name: 'community',
      component: () => import('@/views/CommunityStep.vue'),
      meta: { titleKey: 'community.pageTitle', needsBudget: true },
    },
    {
      path: '/step/priorities',
      name: 'priorities',
      component: () => import('@/views/PrioritiesStep.vue'),
      meta: { titleKey: 'priorities.title', needsBudget: true },
    },
    {
      path: '/results',
      name: 'results',
      component: () => import('@/views/ResultsView.vue'),
      meta: { titleKey: 'results.title', needsBudget: true },
    },
    {
      path: '/suburb/:id',
      name: 'suburb',
      component: () => import('@/views/SuburbView.vue'),
      props: true,
      meta: { titleKey: 'suburb.title', needsBudget: true },
    },
    {
      path: '/summary',
      name: 'summary',
      component: () => import('@/views/SummaryView.vue'),
      meta: { titleKey: 'summary.title', needsBudget: true },
    },
    {
      path: '/support',
      name: 'support',
      component: () => import('@/views/SupportView.vue'),
      meta: { titleKey: 'support.title' },
    },
    {
      path: '/how-it-works',
      name: 'how-it-works',
      component: () => import('@/views/HowItWorksView.vue'),
      meta: { titleKey: 'howItWorks.title' },
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/PrivacyView.vue'),
      meta: { titleKey: 'privacy.title' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { titleKey: 'notFound.title' },
    },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 16 }
    return { top: 0 }
  },
})

// UX, not security. answers only live in memory, so a refresh or a pasted
// link lands here with no budget. send them to the question that's missing
// instead of showing results built from nothing
router.beforeEach((to) => {
  if (to.meta.needsBudget && !useAnswersStore().incomeDone) return { name: 'income' }
})

export function pageTitle(route: RouteLocationNormalized): string {
  const { t } = i18n.global
  return `${t(route.meta.titleKey ?? 'app.name')} | ${t('app.name')}`
}

// title, announcement and focus. without this a keyboard or screen reader
// user stays where they were and has no idea the page changed
router.afterEach((to, from) => {
  document.title = pageTitle(to)

  nextTick(() => {
    // the first load is a real page load, the browser announces that itself.
    // focusing main then would also put the skip link behind the tab order
    if (from.name === undefined) return

    useAnnouncer().announce(
      i18n.global.t('app.pageLoaded', { title: i18n.global.t(to.meta.titleKey) }),
    )

    // a link to #budget lands on that section, everything else on <main>
    const target = to.hash ? document.querySelector<HTMLElement>(to.hash) : null
    ;(target ?? document.getElementById('main-content'))?.focus()
  })
})

export default router
