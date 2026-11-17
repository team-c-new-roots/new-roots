import { computed, type Ref } from 'vue'
import { SHORTLIST_MAX, useAnswersStore } from '@/stores/answers'
import type { Derived } from '@/services/results'

/* the suburbs in the summary (US 2.4), for the cards, the details page and
   the summary itself. until someone adds or removes one it's their top three,
   marked on cards 1 to 3, so what they see is what prints */
export function useSummary(derived: Ref<Derived | null>) {
  const answers = useAnswersStore()

  const topThree = computed(() =>
    (derived.value?.ranked ?? []).slice(0, SHORTLIST_MAX).map((item) => item.id),
  )
  const ids = computed(() => answers.summaryIds(topThree.value))
  // true once they've added or removed a suburb themselves
  const chosen = computed(() => answers.shortlist !== null)

  const has = (id: string) => ids.value.includes(id)

  // false when the summary already has three, and nothing changes
  const toggle = (id: string) => answers.toggleShortlist(id, topThree.value)

  return { ids, chosen, has, toggle }
}
