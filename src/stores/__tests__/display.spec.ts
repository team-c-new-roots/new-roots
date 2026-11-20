import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useDisplayStore } from '../display'

// the site theme and the map's own high contrast colours (panel feedback)
describe('display store', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme
    setActivePinia(createPinia())
  })

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
})
