import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type {
  AdultIncome,
  HomeType,
  IncomeAnswers,
  Importance,
  IncomeSource,
  PayPeriod,
  RatedTopic,
  SchoolNeed,
  YesNo,
} from '@/types'
import { blankAdult, budgetParts, estimateBudget } from '@/services/budget'
import { homeRequest, suggestBedrooms } from '@/services/household'
import { DEFAULT_IMPORTANCE } from '@/data/topics'
import { ENGLISH } from '@/data/languages'

/* everything someone tells New Roots lives here and only here. memory only,
   never localStorage or sessionStorage, so closing the tab really does
   forget it. on a shared phone that matters more than surviving a refresh */

// US 2.4, the summary holds up to five suburbs and starts with the top three.
// five still prints on one A4 page, and leaves room for their own picks
export const SHORTLIST_MAX = 5
export const SHORTLIST_START = 3

export const useAnswersStore = defineStore('answers', () => {
  const adults = ref(1)
  const children = ref(0)
  // null means follow the suggestion, a number means they picked one
  const chosenBedrooms = ref<number | null>(null)
  const homeType = ref<HomeType>('either')

  const incomeSource = ref<IncomeSource | null>(null)
  // what each adult gets from Centrelink, one row per adult on step 1
  const incomes = ref<AdultIncome[]>([blankAdult()])
  const familyTax = ref<YesNo | null>(null)
  const wageAmount = ref<number | null>(null)
  const wagePeriod = ref<PayPeriod>('week')
  const couple = ref<YesNo | null>(null)
  const teens = ref(0)
  const youngestUnderFive = ref<YesNo | null>(null)

  // adding or taking away adults on step 1 adds or drops their rows, keeping
  // what the others already answered
  watch(
    adults,
    (count) => {
      incomes.value = Array.from(
        { length: count },
        (_, index) => incomes.value[index] ?? blankAdult(),
      )
    },
    { flush: 'sync' },
  )

  // parenting payment and family tax benefit need children, so taking the
  // children off step 1 clears them and asks again
  watch(
    children,
    (count) => {
      if (count > 0) return
      familyTax.value = null
      incomes.value = incomes.value.map((income) =>
        income.payment === 'parenting' ? { ...income, payment: null } : income,
      )
    },
    { flush: 'sync' },
  )

  // null is unanswered, 'none' is My language isn't listed, English counts as
  // an answer but not a community, otherwise the census name the scores use
  const communityLanguage = ref<string | null>(null)
  // the data team's name for a language found by searching, to show it back
  const communityLanguageLabel = ref<string | null>(null)
  const importance = reactive<Record<RatedTopic, Importance>>({ ...DEFAULT_IMPORTANCE })
  // US 4.2, suburb ids of up to two places they need to get to, like work or
  // an English class. a suburb, never an address
  const places = ref<string[]>([])
  // null means follow the default, which depends on whether there are children
  const chosenSchoolNeed = ref<SchoolNeed | null>(null)

  // null until they add or remove a suburb. until then the summary is their
  // top three, so it follows the ranking if they change their answers
  const shortlist = ref<string[] | null>(null)

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

  const incomeAnswers = computed<IncomeAnswers>(() => ({
    source: incomeSource.value,
    incomes: incomes.value,
    familyTax: familyTax.value,
    wageAmount: wageAmount.value,
    wagePeriod: wagePeriod.value,
    adults: adults.value,
    children: children.value,
    couple: couple.value,
    teens: teens.value,
    youngestUnderFive: youngestUnderFive.value,
  }))

  const budget = computed(() => estimateBudget(incomeAnswers.value))
  // the same sum line by line, for "how we worked this out" (US 1.1)
  const budgetLines = computed(() => budgetParts(incomeAnswers.value))

  // the results only make sense once there's a budget
  const incomeDone = computed(() => budget.value !== null)

  const home = computed(() => homeRequest(bedrooms.value, homeType.value))

  // almost everyone speaks English, so it can't point to a community and is
  // scored like My language isn't listed
  const censusLanguage = computed(() =>
    communityLanguage.value === 'none' || communityLanguage.value === ENGLISH
      ? null
      : communityLanguage.value,
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
      incomes.value.some((income) => income.payment !== null || income.otherFortnight !== null) ||
      familyTax.value !== null ||
      wageAmount.value !== null ||
      wagePeriod.value !== 'week' ||
      couple.value !== null ||
      teens.value !== 0 ||
      youngestUnderFive.value !== null ||
      communityLanguage.value !== null ||
      chosenSchoolNeed.value !== null ||
      shortlist.value !== null ||
      places.value.length > 0 ||
      (Object.keys(DEFAULT_IMPORTANCE) as RatedTopic[]).some(
        (topic) => importance[topic] !== DEFAULT_IMPORTANCE[topic],
      ),
  )

  // the suburbs in the summary: their own list once they've changed it,
  // otherwise the top three
  function summaryIds(topThree: string[]): string[] {
    return shortlist.value ?? topThree.slice(0, SHORTLIST_START)
  }

  // the first change starts their list from the top three, so nothing they
  // could see goes missing. returns false when it's full, so the caller can
  // ask them to remove one first, and changes nothing in that case
  function toggleShortlist(id: string, topThree: string[]): boolean {
    const current = summaryIds(topThree)
    if (current.includes(id)) {
      shortlist.value = current.filter((item) => item !== id)
      return true
    }
    if (current.length >= SHORTLIST_MAX) return false
    shortlist.value = [...current, id]
    return true
  }

  function clear() {
    adults.value = 1
    children.value = 0
    chosenBedrooms.value = null
    homeType.value = 'either'
    incomeSource.value = null
    incomes.value = [blankAdult()]
    familyTax.value = null
    wageAmount.value = null
    wagePeriod.value = 'week'
    couple.value = null
    teens.value = 0
    youngestUnderFive.value = null
    communityLanguage.value = null
    communityLanguageLabel.value = null
    Object.assign(importance, DEFAULT_IMPORTANCE)
    chosenSchoolNeed.value = null
    shortlist.value = null
    places.value = []
  }

  return {
    places,
    adults,
    children,
    chosenBedrooms,
    homeType,
    incomeSource,
    incomes,
    familyTax,
    wageAmount,
    wagePeriod,
    couple,
    teens,
    youngestUnderFive,
    communityLanguage,
    communityLanguageLabel,
    importance,
    chosenSchoolNeed,
    shortlist,
    people,
    suggestedBedrooms,
    bedrooms,
    schoolNeed,
    budget,
    budgetLines,
    incomeDone,
    home,
    censusLanguage,
    hasAnswers,
    summaryIds,
    toggleShortlist,
    clear,
  }
})
