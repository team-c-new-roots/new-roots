import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAnswersStore } from '@/stores/answers'
import { useResultsStore } from '@/stores/results'
import { toScoreRequest } from '@/services/scoring'
import { buildResults } from '@/services/results'
import type { TopicName } from '@/types'

/* what the results, suburb and summary screens share. asks the scoring API
   whenever the answers change, and sorts what comes back */
export function useResults() {
  const answers = useAnswersStore()
  const store = useResultsStore()
  const { status, data, errorKind } = storeToRefs(store)

  const request = computed(() => {
    const budget = answers.budget
    if (!budget) return null
    return toScoreRequest({
      censusLanguage: answers.censusLanguage,
      importance: answers.importance,
      incomeWeekly: budget.incomeWeekly,
      home: answers.home.request,
    })
  })

  function load(force = false) {
    if (request.value) store.load(request.value, force)
  }

  // the screens using this load straight away, and again if the answers change
  watch(request, () => load(), { immediate: true })

  const derived = computed(() =>
    data.value ? buildResults(data.value, answers.budget?.weekly ?? 0) : null,
  )

  const nothingFits = computed(() => derived.value !== null && derived.value.ranked.length === 0)

  // the topics that count towards this household's ranking. affordability
  // always does, language only once one is chosen
  const counted = computed(() => {
    const topics = new Set<TopicName>(['Affordability'])
    for (const [topic, level] of Object.entries(answers.importance)) {
      if (level === 'not') continue
      if (topic === 'Language' && !answers.censusLanguage) continue
      topics.add(topic as TopicName)
    }
    return topics
  })

  return {
    status,
    errorKind,
    data,
    derived,
    nothingFits,
    counted,
    retry: () => load(true),
  }
}
