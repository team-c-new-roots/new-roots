import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GROUP_OF, PLACE_GROUPS, PLACE_MARGIN_KM, isPlaceType } from '@/data/places'
import { distanceKm, loadPlaces } from '@/services/places'

// vitest runs from the repo root
const script = readFileSync(join(process.cwd(), 'scripts/export_places.py'), 'utf8')

describe('places on the map', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('knows every type the export script writes', () => {
    const block = script.slice(
      script.indexOf('TYPES = {'),
      script.indexOf('}', script.indexOf('TYPES = {')),
    )
    const written = [...block.matchAll(/:\s*"([A-Za-z]+)"/g)].map((match) => match[1]!)
    expect(written.length).toBeGreaterThan(20)
    expect(written.filter((type) => !isPlaceType(type))).toEqual([])
  })

  it('uses the same margin as the export script', () => {
    expect(script).toContain(`MARGIN_KM = ${PLACE_MARGIN_KM}`)
  })

  it('puts each type in exactly one group', () => {
    const all = PLACE_GROUPS.flatMap((group) => group.types)
    expect(new Set(all).size).toBe(all.length)
    expect(GROUP_OF.mosque.id).toBe('worship')
    expect(GROUP_OF.library.id).toBe('community')
  })

  it('only has known types in the exported files', () => {
    const folder = join(process.cwd(), 'public/data/places')
    const files = readdirSync(folder)
    expect(files.length).toBeGreaterThan(500)
    const unknown: string[] = []
    const outside: string[] = []
    for (const file of files) {
      const rows = JSON.parse(readFileSync(join(folder, file), 'utf8')) as unknown[][]
      for (const [type, name, lat, lon] of rows) {
        if (!isPlaceType(String(type)) || !(name === null || typeof name === 'string'))
          unknown.push(`${file} ${type}`)
        if (!(Number(lat) > -39 && Number(lat) < -37 && Number(lon) > 144 && Number(lon) < 146.5))
          outside.push(`${file} ${lat},${lon}`)
      }
    }
    expect(unknown).toEqual([])
    expect(outside).toEqual([])
  })

  it('works out straight line distances', () => {
    // Flinders Street to Southern Cross, about 1.2 km
    const km = distanceKm({ lat: -37.8183, lon: 144.9671 }, { lat: -37.8184, lon: 144.9525 })
    expect(km).toBeGreaterThan(1.2)
    expect(km).toBeLessThan(1.35)
  })

  it('drops types it doesn’t know and only fetches a suburb once', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          ['mosque', 'Dandenong Mosque', -37.98, 145.21],
          ['silo', null, -37.9, 145.2],
        ]),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const places = await loadPlaces('test-1')
    await loadPlaces('test-1')
    expect(places).toEqual([{ type: 'mosque', name: 'Dandenong Mosque', lat: -37.98, lon: 145.21 }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tries again after a failed load', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadPlaces('test-2')).rejects.toThrow('places 500')
    await expect(loadPlaces('test-2')).resolves.toEqual([])
  })
})
