import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { SHORTLIST_MAX, useAnswersStore } from '../answers'

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

  it('holds up to three suburbs in the summary (US 2.4)', () => {
    const answers = useAnswersStore()
    for (let i = 0; i < SHORTLIST_MAX; i++) expect(answers.toggleShortlist(`s${i}`)).toBe(true)
    expect(answers.toggleShortlist('one-more')).toBe(false)
    expect(answers.shortlist).toHaveLength(SHORTLIST_MAX)
    expect(answers.toggleShortlist('s0')).toBe(true)
    expect(answers.shortlist).toHaveLength(SHORTLIST_MAX - 1)
  })

  it('clears everything, shortlist included', () => {
    const answers = useAnswersStore()
    answers.adults = 3
    answers.incomeSource = 'work'
    answers.wageAmount = 900
    answers.importance.Safety = 'very'
    answers.toggleShortlist('20002')
    expect(answers.incomeDone).toBe(true)

    answers.clear()

    expect(answers.adults).toBe(1)
    expect(answers.incomeDone).toBe(false)
    expect(answers.importance.Safety).toBe('not')
    expect(answers.shortlist).toEqual([])
  })
})
