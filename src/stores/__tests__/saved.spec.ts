import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAnswersStore } from '../answers'
import { useSavedStore } from '../saved'
import { useDisplayStore } from '../display'
import { cleanAnswers, KEEP_DAYS, readSaved, SAVED_KEY, writeSaved } from '@/services/saved'

// US 2.7, Save
const DAY = 24 * 60 * 60 * 1000

function stored() {
  const item = localStorage.getItem(SAVED_KEY)
  return item ? JSON.parse(item) : null
}

describe('Save', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('saves nothing until someone chooses to', async () => {
    const answers = useAnswersStore()
    useSavedStore()
    answers.adults = 3
    answers.shortlist = ['20708']
    await nextTick()
    expect(localStorage.length).toBe(0)
  })

  it('keeps the shortlist and answers in step once it is on', async () => {
    const answers = useAnswersStore()
    const saved = useSavedStore()
    answers.shortlist = ['20708', '20002']
    expect(saved.start()).toBe(true)
    expect(stored().answers.shortlist).toEqual(['20708', '20002'])
    answers.shortlist = ['20708']
    await nextTick()
    expect(stored().answers.shortlist).toEqual(['20708'])
  })

  it('brings everything back on the next visit', async () => {
    const answers = useAnswersStore()
    answers.adults = 2
    answers.children = 3
    answers.incomeSource = 'work'
    answers.wageAmount = 900
    answers.places = ['20002']
    answers.shortlist = ['20708']
    answers.importance.Safety = 'very'
    useDisplayStore().setTheme('dark')
    useSavedStore().start()

    // a new visit is a fresh set of stores
    setActivePinia(createPinia())
    const next = useSavedStore()
    await next.load()
    const back = useAnswersStore()
    expect(next.on).toBe(true)
    expect(back.adults).toBe(2)
    expect(back.children).toBe(3)
    expect(back.wageAmount).toBe(900)
    expect(back.places).toEqual(['20002'])
    expect(back.shortlist).toEqual(['20708'])
    expect(back.importance.Safety).toBe('very')
    expect(useDisplayStore().theme).toBe('dark')
  })

  // saved before the theme was kept on its own, so only Save's copy has it
  it('still brings back the theme from an older saved copy', async () => {
    writeSaved({ answers: cleanAnswers({}), language: 'en-AU', theme: 'dark', mapContrast: true })
    await useSavedStore().load()
    expect(useDisplayStore().theme).toBe('dark')
    expect(useDisplayStore().mapContrast).toBe(true)
  })

  it('removes the saved copy straight away when turned off', () => {
    const saved = useSavedStore()
    saved.start()
    expect(stored()).not.toBeNull()
    saved.stop()
    expect(stored()).toBeNull()
    expect(saved.on).toBe(false)
  })

  it('never stores a name, address, phone, email or visa field', () => {
    useAnswersStore().shortlist = ['20708']
    useSavedStore().start()
    const text = localStorage.getItem(SAVED_KEY)!.toLowerCase()
    for (const word of ['name"', 'address', 'phone', 'email', 'visa']) {
      expect(text).not.toContain(word)
    }
  })

  it('forgets it 30 days after the last visit', () => {
    const now = Date.now()
    writeSaved(
      { answers: cleanAnswers({}), language: 'en-AU', theme: 'default', mapContrast: false },
      now - (KEEP_DAYS + 1) * DAY,
    )
    expect(readSaved(now)).toBeNull()
    expect(stored()).toBeNull()
  })

  it('ignores anything that has been tampered with', () => {
    localStorage.setItem(SAVED_KEY, '{not json')
    expect(readSaved()).toBeNull()
    expect(stored()).toBeNull()

    const odd = cleanAnswers({
      adults: 500,
      homeType: '<img src=x>',
      shortlist: ['20708', 'javascript:alert(1)'],
      places: ['1', '2', '3'],
      importance: { Safety: 'extreme', Transport: 'very' },
      incomes: [{ payment: 'jobseeker', otherFortnight: -5 }],
    })
    expect(odd.adults).toBe(1)
    expect(odd.homeType).toBe('either')
    expect(odd.shortlist).toBeNull()
    expect(odd.places).toEqual([])
    expect(odd.importance.Safety).toBe('not')
    expect(odd.importance.Transport).toBe('very')
    expect(odd.incomes).toEqual([{ payment: 'jobseeker', otherFortnight: null }])
  })
})
