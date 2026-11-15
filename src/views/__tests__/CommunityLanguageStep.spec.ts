import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/i18n'
import { useAnswersStore } from '@/stores/answers'
import { ENGLISH } from '@/data/languages'
import languageIndex from '../../../public/data/languages/index.json'
import CommunityLanguageStep from '../CommunityLanguageStep.vue'

// the real index, so the searches below match what people actually see
vi.mock('@/services/appData', () => ({
  loadLanguageIndex: () => Promise.resolve(languageIndex),
}))

async function search(query: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  const wrapper = mount(CommunityLanguageStep, {
    global: {
      plugins: [i18n, router],
      // the step's heading, back link and Next button aren't what's tested here
      stubs: { StepLayout: { template: '<div><slot /></div>' } },
    },
  })
  await flushPromises()
  await wrapper.get('#language-search').setValue(query)

  const shown = wrapper
    .findAll('#language-matches input[type="radio"]')
    .map((input) => (input.element as HTMLInputElement).value)
  const status = wrapper.get('#language-search-status').text()
  return { shown, status }
}

describe('language search', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows no more than 8 when lots of languages match', async () => {
    const { shown, status } = await search('ar')
    expect(shown).toHaveLength(8)
    expect(shown[0]).toBe('Arabic')
    expect(status).toBe('Showing 8 of 20 matches. Type more to narrow it down.')
  })

  // "en" finds 8 languages and English. English used to go on top of the 8,
  // so 9 showed while the status said 8
  it('keeps English inside the 8', async () => {
    const { shown, status } = await search('en')
    expect(shown).toHaveLength(8)
    expect(shown[0]).toBe(ENGLISH)
    expect(status).toBe('Showing 8 of 9 matches. Type more to narrow it down.')
  })

  // someone picked Tamil, then searched again. Tamil stays on screen but it's
  // their answer, not a match, so the status doesn't count it
  it('keeps an earlier pick inside the 8 without counting it as a match', async () => {
    useAnswersStore().communityLanguage = 'Tamil'
    const { shown, status } = await search('ish')
    expect(shown).toHaveLength(8)
    expect(shown.slice(0, 2)).toEqual([ENGLISH, 'Tamil'])
    expect(status).toBe('Showing 7 of 12 matches. Type more to narrow it down.')
  })

  it("doesn't show an earlier pick twice when the search finds it", async () => {
    useAnswersStore().communityLanguage = 'Spanish'
    const { shown, status } = await search('ish')
    expect(shown.filter((name) => name === 'Spanish')).toHaveLength(1)
    expect(shown).toHaveLength(8)
    expect(status).toBe('Showing 8 of 12 matches. Type more to narrow it down.')
  })

  it('says how many match when they all fit', async () => {
    const { shown, status } = await search('tamil')
    expect(shown).toEqual(['Tamil'])
    expect(status).toBe('One language matches')
  })
})
