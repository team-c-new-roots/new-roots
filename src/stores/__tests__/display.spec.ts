import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useDisplayStore } from '../display'
import { useSavedStore } from '../saved'
import { DISPLAY_KEY } from '@/services/display'

// the site theme and the map's own high contrast colours (panel feedback)
describe('display store', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    setActivePinia(createPinia())
  })

  // a reload is a fresh set of stores reading the same browser
  function reload() {
    delete document.documentElement.dataset.theme
    setActivePinia(createPinia())
    return useDisplayStore()
  }

  it('starts on the brand theme with the brand map colours', () => {
    const display = useDisplayStore()
    expect(display.theme).toBe('default')
    expect(display.mapContrast).toBe(false)
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('marks the page for the dark and high contrast themes, and clears it for the default', async () => {
    const display = useDisplayStore()
    display.setTheme('dark')
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')
    display.setTheme('contrast')
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('contrast')
    display.setTheme('default')
    await nextTick()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('changes only the map when the map switch is used', async () => {
    const display = useDisplayStore()
    display.toggleMapContrast()
    await nextTick()
    expect(display.mapContrast).toBe(true)
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('turns the map colours on with the high contrast theme, and lets them go off again', async () => {
    const display = useDisplayStore()
    display.setTheme('contrast')
    await nextTick()
    expect(display.mapContrast).toBe(true)
    display.toggleMapContrast()
    expect(display.mapContrast).toBe(false)
    expect(display.theme).toBe('contrast')
  })

  // Ishara's testing: a low vision user shouldn't have to pick it every visit
  it('keeps the theme after a reload with Save off', async () => {
    const display = useDisplayStore()
    expect(useSavedStore().on).toBe(false)
    display.setTheme('dark')
    await nextTick()
    const next = reload()
    expect(next.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('keeps high contrast with the map colours turned off', async () => {
    const display = useDisplayStore()
    display.setTheme('contrast')
    display.toggleMapContrast()
    await nextTick()
    const next = reload()
    expect(next.theme).toBe('contrast')
    expect(next.mapContrast).toBe(false)
  })

  it('writes nothing until someone picks a theme', async () => {
    useDisplayStore()
    await nextTick()
    expect(localStorage.getItem(DISPLAY_KEY)).toBeNull()
  })

  it('keeps only the theme and map colours, nothing about the person', async () => {
    useDisplayStore().setTheme('dark')
    await nextTick()
    expect(JSON.parse(localStorage.getItem(DISPLAY_KEY)!)).toEqual({
      theme: 'dark',
      mapContrast: false,
    })
  })

  it('keeps the theme when the details are cleared', async () => {
    const saved = useSavedStore()
    saved.start()
    useDisplayStore().setTheme('dark')
    await nextTick()
    saved.stop()
    expect(reload().theme).toBe('dark')
  })

  it('falls back to the brand theme if the kept value has been tampered with', () => {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify({ theme: '<img src=x>', mapContrast: 'yes' }))
    const display = reload()
    expect(display.theme).toBe('default')
    expect(display.mapContrast).toBe(false)
    localStorage.setItem(DISPLAY_KEY, '{not json')
    expect(reload().theme).toBe('default')
  })
})
