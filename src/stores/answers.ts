import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  CommunityLanguage,
  HomeType,
  Importance,
  IncomeSource,
  PaymentType,
  PayPeriod,
  Topic,
} from '@/types'
import { estimateBudget } from '@/services/budget'
import { suggestBedrooms } from '@/services/household'

/* everything someone tells New Roots lives here and only here. memory only,
   never localStorage or sessionStorage, so closing the tab really does
   forget it. on a shared phone that matters more than surviving a refresh */

const DEFAULT_IMPORTANCE: Record<Topic, Importance> = {
  community: 'important',
  essentials: 'important',
  // reported crime starts at Not important, from the ethics canvas
  crime: 'not',
}

export const useAnswersStore = defineStore('answers', () => {
  const adults = ref(1)
  const children = ref(0)
  // null means follow the suggestion, a number means they picked one
  const chosenBedrooms = ref<number | null>(null)
  const homeType = ref<HomeType>('either')

  const incomeSource = ref<IncomeSource | null>(null)
  const payments = ref<PaymentType[]>([])
  const otherPaymentFortnight = ref<number | null>(null)
  const wageAmount = ref<number | null>(null)
  const wagePeriod = ref<PayPeriod>('week')

  // null is unanswered, 'none' is My language isn't listed
  const communityLanguage = ref<CommunityLanguage | 'none' | null>(null)
  const importance = reactive<Record<Topic, Importance>>({ ...DEFAULT_IMPORTANCE })

  const shortlist = ref<string[]>([])

  const people = computed(() => adults.value + children.value)
  const suggestedBedrooms = computed(() => suggestBedrooms(adults.value, children.value))
  const bedrooms = computed({
    get: () => chosenBedrooms.value ?? suggestedBedrooms.value,
    set: (value: number) => {
      chosenBedrooms.value = value
    },
  })

  const budget = computed(() =>
    estimateBudget({
      source: incomeSource.value,
      payments: payments.value,
      otherPaymentFortnight: otherPaymentFortnight.value,
      wageAmount: wageAmount.value,
      wagePeriod: wagePeriod.value,
      children: children.value,
    }),
  )

  // the results only make sense once there's a budget
  const incomeDone = computed(() => budget.value !== null)

  // anything moved off its default. Clear my details only shows once this is
  // true, on every screen size, so there's never a button that clears nothing
  const hasAnswers = computed(
    () =>
      adults.value !== 1 ||
      children.value !== 0 ||
      chosenBedrooms.value !== null ||
      homeType.value !== 'either' ||
      incomeSource.value !== null ||
      payments.value.length > 0 ||
      otherPaymentFortnight.value !== null ||
      wageAmount.value !== null ||
      wagePeriod.value !== 'week' ||
      communityLanguage.value !== null ||
      shortlist.value.length > 0 ||
      (Object.keys(DEFAULT_IMPORTANCE) as Topic[]).some(
        (topic) => importance[topic] !== DEFAULT_IMPORTANCE[topic],
      ),
  )

  const rankingLanguage = computed<CommunityLanguage | null>(() =>
    communityLanguage.value === 'none' ? null : communityLanguage.value,
  )

  function isShortlisted(id: string) {
    return shortlist.value.includes(id)
  }

  function toggleShortlist(id: string) {
    shortlist.value = isShortlisted(id)
      ? shortlist.value.filter((item) => item !== id)
      : [...shortlist.value, id]
  }

  function clear() {
    adults.value = 1
    children.value = 0
    chosenBedrooms.value = null
    homeType.value = 'either'
    incomeSource.value = null
    payments.value = []
    otherPaymentFortnight.value = null
    wageAmount.value = null
    wagePeriod.value = 'week'
    communityLanguage.value = null
    Object.assign(importance, DEFAULT_IMPORTANCE)
    shortlist.value = []
  }

  return {
    adults,
    children,
    chosenBedrooms,
    homeType,
    incomeSource,
    payments,
    otherPaymentFortnight,
    wageAmount,
    wagePeriod,
    communityLanguage,
    importance,
    shortlist,
    people,
    suggestedBedrooms,
    bedrooms,
    budget,
    incomeDone,
    hasAnswers,
    rankingLanguage,
    isShortlisted,
    toggleShortlist,
    clear,
  }
})
