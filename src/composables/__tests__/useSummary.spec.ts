import { beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Derived, SuburbResult } from '@/services/results'
import { useSummary } from '../useSummary'

// only the ids matter to the summary
const suburb = (id: string) => ({ id }) as SuburbResult

function derived(ranked: string[], closest: string[]): Derived {
  const all = [...new Set([...ranked, ...closest, 'x', 'y'])].map(suburb)
  return {
    all,
    ranked: ranked.map(suburb),
    listed: all,
    closest: closest.map(suburb),
    byId: new Map(all.map((item) => [item.id, item])),
  }
}

describe('useSummary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with the top three when suburbs fit', () => {
    const summary = useSummary(ref(derived(['a', 'b', 'c', 'd'], [])))
    expect(summary.ids.value).toEqual(['a', 'b', 'c'])
    expect(summary.nothingFits.value).toBe(false)
  })

  // so the page for a caseworker shows the gap rather than an empty list
  it('starts with the three closest to the budget when nothing fits', () => {
    const summary = useSummary(ref(derived([], ['p', 'q', 'r'])))
    expect(summary.ids.value).toEqual(['p', 'q', 'r'])
    expect(summary.nothingFits.value).toBe(true)
    expect(summary.chosen.value).toBe(false)
  })

  it('keeps their own list once they change it, even when nothing fits', () => {
    const summary = useSummary(ref(derived([], ['p', 'q', 'r'])))
    summary.toggle('q')
    summary.toggle('x')
    expect(summary.ids.value).toEqual(['p', 'r', 'x'])
    expect(summary.chosen.value).toBe(true)
  })
})
