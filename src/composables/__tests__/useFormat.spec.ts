import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import { useFormat } from '../useFormat'

function homes(labels: Parameters<ReturnType<typeof useFormat>['home']>[0][]) {
  let out: string[] = []
  mount(
    defineComponent({
      setup() {
        const { home } = useFormat()
        out = labels.map(home)
        return () => h('div')
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return out
}

describe('home labels', () => {
  it('names the size the household asked for', () => {
    expect(
      homes([
        { type: 'house', bedrooms: 4 },
        { type: 'flat', bedrooms: 1 },
        { type: 'either', bedrooms: 3 },
      ]),
    ).toEqual(['4-bed house', '1-bed flat', '3-bed home'])
  })

  // the testers saw "5+-bed house"
  it('words 5 or more bedrooms without a stray hyphen', () => {
    expect(
      homes([
        { type: 'house', bedrooms: 5 },
        { type: 'flat', bedrooms: 6 },
        { type: 'either', bedrooms: 7 },
      ]),
    ).toEqual(['5+ bedroom house', '5+ bedroom flat', '5+ bedroom home'])
  })
})
