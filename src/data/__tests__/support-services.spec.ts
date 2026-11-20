import { describe, expect, it } from 'vitest'
import en from '@/i18n/en'
import { CATEGORIES, SUPPORT_SERVICES } from '../support-services'

// US 3.3, the directory grouped by need. a broken number or an empty need
// sends someone to a dead end, so these get checked on every build.
// each test lists what's wrong, so a failure names the service
describe('support directory', () => {
  it('has at least one service for every need', () => {
    const empty = CATEGORIES.filter(
      ({ id }) => !SUPPORT_SERVICES.some((service) => service.categories.includes(id)),
    )
    expect(empty).toEqual([])
  })

  it('dials the number it shows', () => {
    const wrong = SUPPORT_SERVICES.filter(
      (service) => service.phone && service.tel !== service.phone.replace(/\D/g, ''),
    )
    expect(wrong).toEqual([])
  })

  it('only links to secure sites, Ask Izzy included', () => {
    const insecure = SUPPORT_SERVICES.filter(
      (service) => service.url && !service.url.startsWith('https://'),
    )
    expect(insecure).toEqual([])
    const askIzzy = CATEGORIES.filter(
      (entry) => entry.askIzzy && !entry.askIzzy.startsWith('https://askizzy.org.au/'),
    )
    expect(askIzzy).toEqual([])
  })

  it('has words for every need, service and opening hours', () => {
    const services = en.support.services as Record<string, string>
    const hours = en.support.hours as Record<string, string>
    const missing = [
      ...CATEGORIES.filter(
        ({ id }) => !en.support.categories[id] || !en.support.categoryHints[id],
      ).map(({ id }) => id),
      ...SUPPORT_SERVICES.filter(
        (service) => !services[service.id] || (service.hours && !hours[service.hours]),
      ).map(({ id }) => id),
    ]
    expect(missing).toEqual([])
  })

  it('keeps services that need permanent residency out of the seeking asylum filter', () => {
    const open = SUPPORT_SERVICES.filter((service) => service.visaNote !== 'permanentOnly')
    expect(open.map((service) => service.id)).not.toContain('bondLoans')
    expect(open.length).toBeGreaterThan(20)
  })
})
