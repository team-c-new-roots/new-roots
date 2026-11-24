import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import type { ObtRow } from '@/types/scoring'
import NearbyServices from '../NearbyServices.vue'

function row(id: string, figures: Record<string, number | null>): ObtRow {
  return { suburb_id: id, suburb_name: id, suburb_area_km2: 1, ...figures }
}

function texts(obt: ObtRow, all: ObtRow[]) {
  const wrapper = mount(NearbyServices, {
    props: { obt, suburb: 'Footscray', all },
    global: { plugins: [i18n] },
  })
  return wrapper.findAll('li').map((item) => item.text())
}

// US 4.3
describe('nearby services', () => {
  const near = row('a', { pharmacy_proximity_value: 0.34, gp_proximity_value: 1.6 })

  it('gives a walk up to 20 minutes with the distance after it, and just the distance past that', () => {
    expect(texts(near, [near])).toEqual(['PharmacyAbout 5 minutes’ walk (350 m)', 'GP1.6 km away'])
  })

  it('says plainly when one suburb has no figure that others have', () => {
    const missing = row('b', { pharmacy_proximity_value: null, gp_proximity_value: 0.5 })
    expect(texts(missing, [near, missing])[0]).toBe(
      'PharmacyWe don’t have a figure for Footscray yet.',
    )
  })

  it('leaves a service off while no suburb has figures for it', () => {
    expect(texts(near, [near]).some((text) => text.includes('Services Australia'))).toBe(false)
  })
})
