import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAnswersStore } from '../answers'

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
    answers.importance.crime = 'important'
    expect(answers.hasAnswers).toBe(true)
    answers.clear()
    expect(answers.hasAnswers).toBe(false)
  })

  it('starts reported crime at Not important', () => {
    expect(useAnswersStore().importance.crime).toBe('not')
  })

  it('clears everything, shortlist included', () => {
    const answers = useAnswersStore()
    answers.adults = 3
    answers.incomeSource = 'work'
    answers.wageAmount = 900
    answers.importance.crime = 'very'
    answers.toggleShortlist('doveton')
    expect(answers.incomeDone).toBe(true)

    answers.clear()

    expect(answers.adults).toBe(1)
    expect(answers.incomeDone).toBe(false)
    expect(answers.importance.crime).toBe('not')
    expect(answers.shortlist).toEqual([])
  })
})
