import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  CommunityLanguage,
  HomeType,
  Importance,
  IncomeSource,
  PaymentType,
  PayPeriod,
  RatedTopic,
  SchoolNeed,
  YesNo,
} from '@/types'
import { estimateBudget } from '@/services/budget'
import { homeRequest, suggestBedrooms } from '@/services/household'
import { DEFAULT_IMPORTANCE } from '@/data/topics'
import { CENSUS_NAMES } from '@/data/languages'

/* everything someone tells New Roots lives here and only here. memory only,
   never localStorage or sessionStorage, so closing the tab really does
   forget it. on a shared phone that matters more than surviving a refresh */

// US 2.4, the summary holds up to three suburbs
export const SHORTLIST_MAX = 3

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
  const couple = ref<YesNo | null>(null)
  const teens = ref(0)
  const youngestUnderFive = ref<YesNo | null>(null)

  // null is unanswered, 'none' is My language isn't listed
  const communityLanguage = ref<CommunityLanguage | 'none' | null>(null)
  const importance = reactive<Record<RatedTopic, Importance>>({ ...DEFAULT_IMPORTANCE })
  // null means follow the default, which depends on whether there are children
  const chosenSchoolNeed = ref<SchoolNeed | null>(null)

  const shortlist = ref<string[]>([])

  const people = computed(() => adults.value + children.value)
  const suggestedBedrooms = computed(() => suggestBedrooms(adults.value, children.value))
  const bedrooms = computed({
    get: () => chosenBedrooms.value ?? suggestedBedrooms.value,
    set: (value: number) => {
      chosenBedrooms.value = value
    },
  })

  const schoolNeed = computed({
    get: (): SchoolNeed => chosenSchoolNeed.value ?? (children.value > 0 ? 'both' : 'none'),
    set: (value: SchoolNeed) => {
      chosenSchoolNeed.value = value
    },
  })

  const budget = computed(() =>
    estimateBudget({
      source: incomeSource.value,
      payments: payments.value,
      otherPaymentFortnight: otherPaymentFortnight.value,
      wageAmount: wageAmount.value,
      wagePeriod: wagePeriod.value,
      adults: adults.value,
      children: children.value,
      couple: couple.value,
      teens: teens.value,
      youngestUnderFive: youngestUnderFive.value,
    }),
  )

  // the results only make sense once there's a budget
  const incomeDone = computed(() => budget.value !== null)

  const home = computed(() => homeRequest(bedrooms.value, homeType.value))

  const rankingLanguage = computed<CommunityLanguage | null>(() =>
    communityLanguage.value === 'none' ? null : communityLanguage.value,
  )
  const censusLanguage = computed(() =>
    rankingLanguage.value ? CENSUS_NAMES[rankingLanguage.value] : null,
  )

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
      couple.value !== null ||
      teens.value !== 0 ||
      youngestUnderFive.value !== null ||
      communityLanguage.value !== null ||
      chosenSchoolNeed.value !== null ||
      shortlist.value.length > 0 ||
      (Object.keys(DEFAULT_IMPORTANCE) as RatedTopic[]).some(
        (topic) => importance[topic] !== DEFAULT_IMPORTANCE[topic],
      ),
  )

  function isShortlisted(id: string) {
    return shortlist.value.includes(id)
  }

  const shortlistFull = computed(() => shortlist.value.length >= SHORTLIST_MAX)

  // returns false when the summary is already full, so the caller can say why
  function toggleShortlist(id: string): boolean {
    if (isShortlisted(id)) {
      shortlist.value = shortlist.value.filter((item) => item !== id)
      return true
    }
    if (shortlistFull.value) return false
    shortlist.value = [...shortlist.value, id]
    return true
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
    couple.value = null
    teens.value = 0
    youngestUnderFive.value = null
    communityLanguage.value = null
    Object.assign(importance, DEFAULT_IMPORTANCE)
    chosenSchoolNeed.value = null
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
    couple,
    teens,
    youngestUnderFive,
    communityLanguage,
    importance,
    chosenSchoolNeed,
    shortlist,
    people,
    suggestedBedrooms,
    bedrooms,
    schoolNeed,
    budget,
    incomeDone,
    home,
    rankingLanguage,
    censusLanguage,
    hasAnswers,
    shortlistFull,
    isShortlisted,
    toggleShortlist,
    clear,
  }
})
