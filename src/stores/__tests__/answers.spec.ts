import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { SHORTLIST_MAX, SHORTLIST_START, useAnswersStore } from '../answers'

describe('answers store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('follows the bedroom suggestion until someone picks a number', () => {
    const answers = useAnswersStore()
    answers.adults = 2
    answers.children = 5
    expect(answers.bedrooms).toBe(4)
    answers.bedrooms = 3
    answers.children = 6
    expect(answers.bedrooms).toBe(3)
  })

  it('only has answers to clear once something moves off its default', () => {
    const answers = useAnswersStore()
    expect(answers.hasAnswers).toBe(false)
    answers.importance.Safety = 'important'
    expect(answers.hasAnswers).toBe(true)
    answers.clear()
    expect(answers.hasAnswers).toBe(false)
  })

  it('starts reported crime at Not important', () => {
    expect(useAnswersStore().importance.Safety).toBe('not')
  })

  it('asks about both kinds of school only when there are children', () => {
    const answers = useAnswersStore()
    expect(answers.schoolNeed).toBe('none')
    answers.children = 2
    expect(answers.schoolNeed).toBe('both')
    answers.schoolNeed = 'primary'
    expect(answers.schoolNeed).toBe('primary')
  })

  it('keeps one row of payment answers per adult', () => {
    const answers = useAnswersStore()
    answers.incomes[0]!.payment = 'jobseeker'
    answers.adults = 3
    expect(answers.incomes.map((income) => income.payment)).toEqual(['jobseeker', null, null])
    answers.adults = 1
    expect(answers.incomes.map((income) => income.payment)).toEqual(['jobseeker'])
  })

  it('asks again about Parenting Payment and Family Tax Benefit once there are no children', () => {
    const answers = useAnswersStore()
    answers.adults = 2
    answers.children = 2
    answers.incomes[0]!.payment = 'parenting'
    answers.incomes[1]!.payment = 'jobseeker'
    answers.familyTax = 'yes'
    answers.children = 0
    expect(answers.incomes.map((income) => income.payment)).toEqual([null, 'jobseeker'])
    expect(answers.familyTax).toBeNull()
  })

  it('keeps the couple answer when an adult is taken off, but budgets them as single', () => {
    const answers = useAnswersStore()
    answers.adults = 2
    answers.incomeSource = 'payments'
    answers.couple = 'yes'
    answers.incomes[0]!.payment = 'jobseeker'
    answers.incomes[1]!.payment = 'jobseeker'
    expect(answers.budget?.weekly).toBe(260)
    answers.adults = 1
    expect(answers.couple).toBe('yes')
    expect(answers.budget?.rentAssistanceWeekly).toBe(111.9)
    // adding them back picks the couple up again with their old answer blank
    answers.adults = 2
    expect(answers.budget).toBeNull()
    answers.incomes[1]!.payment = 'jobseeker'
    expect(answers.budget?.weekly).toBe(260)
  })

  it('takes English as an answer but not a community to rank on', () => {
    const answers = useAnswersStore()
    answers.communityLanguage = 'English'
    expect(answers.censusLanguage).toBeNull()
    answers.communityLanguage = 'Dari'
    expect(answers.censusLanguage).toBe('Dari')
  })

  // US 2.4, the summary starts as the top three and becomes their own list
  // the first time they add or remove a suburb. it holds up to five
  const TOP = ['a', 'b', 'c']

  it('holds five and starts with three', () => {
    expect(SHORTLIST_MAX).toBe(5)
    expect(SHORTLIST_START).toBe(3)
  })

  it('starts the summary with the top three and follows them until it changes', () => {
    const answers = useAnswersStore()
    expect(answers.summaryIds(TOP)).toEqual(TOP)
    expect(answers.summaryIds(['d', 'e', 'f', 'g'])).toHaveLength(SHORTLIST_START)
    expect(answers.summaryIds(['d'])).toEqual(['d'])
  })

  it('adds a fourth and fifth, then asks them to remove one and changes nothing', () => {
    const answers = useAnswersStore()
    expect(answers.toggleShortlist('d', TOP)).toBe(true)
    expect(answers.toggleShortlist('e', TOP)).toBe(true)
    expect(answers.summaryIds(TOP)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(answers.toggleShortlist('f', TOP)).toBe(false)
    expect(answers.summaryIds(TOP)).toHaveLength(SHORTLIST_MAX)
  })

  it('swaps a suburb in once they remove one, the way Daniel tried with Hampton Park', () => {
    const answers = useAnswersStore()
    expect(answers.toggleShortlist('b', TOP)).toBe(true)
    expect(answers.summaryIds(TOP)).toEqual(['a', 'c'])
    expect(answers.toggleShortlist('d', TOP)).toBe(true)
    expect(answers.summaryIds(TOP)).toEqual(['a', 'c', 'd'])
    // their own list stays put if the ranking changes
    expect(answers.summaryIds(['x', 'y', 'z'])).toEqual(['a', 'c', 'd'])
    expect(answers.toggleShortlist('e', TOP)).toBe(true)
    expect(answers.toggleShortlist('f', TOP)).toBe(true)
    expect(answers.toggleShortlist('g', TOP)).toBe(false)
  })

  it('adds to a top three that has room without asking', () => {
    const answers = useAnswersStore()
    expect(answers.toggleShortlist('d', ['a'])).toBe(true)
    expect(answers.summaryIds(['a'])).toEqual(['a', 'd'])
  })

  it('clears everything, shortlist included', () => {
    const answers = useAnswersStore()
    answers.adults = 3
    answers.incomeSource = 'work'
    answers.wageAmount = 900
    answers.importance.Safety = 'very'
    answers.toggleShortlist('20002', [])
    expect(answers.incomeDone).toBe(true)

    answers.clear()

    expect(answers.adults).toBe(1)
    expect(answers.incomeDone).toBe(false)
    expect(answers.importance.Safety).toBe('not')
    expect(answers.shortlist).toBeNull()
  })
})
