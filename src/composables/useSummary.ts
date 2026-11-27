import { computed, type Ref } from 'vue'
import { SHORTLIST_MAX, SHORTLIST_START, useAnswersStore } from '@/stores/answers'
import type { Derived } from '@/services/results'

/* the suburbs in the summary (US 2.4), for the cards, the details page and
   the summary itself. until someone adds or removes one it's their top three,
   marked on cards 1 to 3, so what they see is what prints. it holds up to
   five, and the count is shown wherever suburbs get added. when nothing fits
   it starts with the three closest to the budget instead, so the page they
   take to a caseworker shows the gap rather than an empty list */
export function useSummary(derived: Ref<Derived | null>) {
  const answers = useAnswersStore()

  const nothingFits = computed(() => derived.value !== null && derived.value.ranked.length === 0)
  const topThree = computed(() => {
    const found = derived.value
    if (!found) return []
    const start = nothingFits.value ? found.closest : found.ranked
    return start.slice(0, SHORTLIST_START).map((item) => item.id)
  })
  const ids = computed(() => answers.summaryIds(topThree.value))
  // true once they've added or removed a suburb themselves
  const chosen = computed(() => answers.shortlist !== null)

  const has = (id: string) => ids.value.includes(id)
  const count = computed(() => ids.value.length)
  const full = computed(() => count.value >= SHORTLIST_MAX)

  // false when the summary already has three, and nothing changes
  const toggle = (id: string) => answers.toggleShortlist(id, topThree.value)

  return { ids, chosen, nothingFits, has, toggle, count, full, max: SHORTLIST_MAX }
}
