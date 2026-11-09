import { computed } from 'vue'
import { useAnswersStore } from '@/stores/answers'
import { rankSuburbs } from '@/services/ranking'
import { SAMPLE_SUBURBS } from '@/data/sample-suburbs'
import type { RankingResult } from '@/types'

// the ranking, worked out from the answers every time they change. it runs on
// the phone, so the answers never have to leave it. when the real data arrives
// only the suburb list here changes
export function useResults() {
  const answers = useAnswersStore()

  const result = computed<RankingResult | null>(() => {
    const budget = answers.budget
    if (!budget) return null
    return rankSuburbs(SAMPLE_SUBURBS, {
      budget: budget.weekly,
      bedrooms: answers.bedrooms,
      homeType: answers.homeType,
      communityLanguage: answers.rankingLanguage,
      importance: answers.importance,
    })
  })

  const nothingFits = computed(() => result.value !== null && result.value.ranked.length === 0)

  return { result, nothingFits }
}
