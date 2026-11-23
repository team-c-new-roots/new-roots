<script setup lang="ts">
import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  render,
  watch,
  type Component,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { Layers, MapPin, X } from '@lucide/vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, Geometry } from 'geojson'
import type { TopicName } from '@/types'
import { loadBoundaries, type BoundaryProperties } from '@/services/boundaries'
import { bandFor, type SuburbResult } from '@/services/results'
import { TOPICS } from '@/data/topics'
import { GROUP_OF, type PlaceType } from '@/data/places'
import { distanceKm, loadPlaces, type Place } from '@/services/places'
import { useFormat } from '@/composables/useFormat'
import { useDisplayStore } from '@/stores/display'
import BudgetBadge from '@/components/ui/BudgetBadge.vue'
import MapContrastToggle from './MapContrastToggle.vue'
import TopicBars from './TopicBars.vue'
import MapLegend from './MapLegend.vue'
import PlaceFilters from './PlaceFilters.vue'

/* every suburb coloured by how well it fits this household, on the real ABS
   shapes, styled after the data team's map: score bubbles, topic scores on
   hover, and a panel with the topic bars for the chosen suburb.

   decisions worth knowing:
   - every suburb is coloured, nothing is greyed out. a suburb with no rent
     figure keeps its colour and gets a dashed outline, so it's flagged
     without looking excluded
   - labels group by zoom. zoomed out, nearby suburbs share one bubble with
     the best score and a +count, and they split apart as you zoom in. names
     join the scores once there's room for them
   - scroll wheel zoom waits for a click on the map, the same as Iris, so the
     page doesn't get stuck scrolling the map. pinch works on phones anyway
   - no street pictures by default. they cost data and tell OpenStreetMap the
     device's address, so they're a button away rather than always on
   - the select under the map is the keyboard and screen reader way in, and
     the list carries the same information, so the map is never the only route
   - loaded on its own, so only people who open the map download Leaflet
   - WCAG contrast only counts lightness, so five fills can't all be 3:1
     from each other whatever the hues (that needs 81:1, black on white is
     21:1). the High contrast switch uses white, yellow, teal, blue and
     black, lightest to best, and fixes the edges instead, the way the W3C
     pie chart example does: every edge is a black line with white either
     side, and one of the two is at least 5.2:1 against any fill. teal
     splits the yellow to blue gap about evenly and stays apart from both
     with red-green colour blindness. only the map changes, scores stay
     written on it and the list has the same figures */

const props = defineProps<{
  suburbs: SuburbResult[]
  counted: Set<TopicName>
  hasLanguage: boolean
  // how many suburbs made the list, for "Ranked 3 of 48"
  total: number
  // wide screens put the panel beside the map rather than under it
  side?: boolean
  // a card's Show on map. the nonce lets the same suburb be asked for twice
  focus?: { id: string; nonce: number } | null
}>()

const selectedId = defineModel<string | null>('selected', { default: null })

const { t } = useI18n()
const display = useDisplayStore()
const container = ref<HTMLElement | null>(null)
const picker = ref<HTMLSelectElement | null>(null)
const panelHeading = ref<HTMLHeadingElement | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const showStreets = ref(false)
const zoomArmed = ref(false)
const canHover = window.matchMedia('(hover: hover)').matches

// names join other suburbs' scores from this zoom in, and the numbered pins
// a little earlier because there are only ten of them
const NAME_ZOOM = 12.5
const PIN_NAME_ZOOM = 11
const TOP_PINS = 10
// label sizes and the breathing room around each, in pixels. each label owns
// an area a little wider than the widest label it could become
const LABEL_GAP = 3
const LABEL_HEIGHT = 26
const PIN_HEIGHT = 32
// zoomed out, a group gathers a wide area, so the city view is a handful of
// groups and the pins. zoomed in, each label only needs its own space
const OVERVIEW_ZOOM = 11
const OVERVIEW_AREA = { width: 170, height: 70 }
const SCORE_AREA = { width: 112, height: 34 }
const NAMED_AREA = { width: 175, height: 34 }
// below this the top 10 shrink to small numbered dots, so they crowd less
const SMALL_PIN_ZOOM = 10.5

let map: L.Map | null = null
let shapes: L.GeoJSON<BoundaryProperties> | null = null
let edges: L.GeoJSON<BoundaryProperties> | null = null
let labels: L.LayerGroup | null = null
let tiles: L.TileLayer | null = null
let features: Feature<Geometry, BoundaryProperties>[] = []
let placePins: L.LayerGroup | null = null

/* places near the chosen suburb (US 3.2, US 3.4). nothing is chosen at the
   start and nothing is saved, so it all resets when the page closes */
const { km } = useFormat()
const placesButton = ref<HTMLButtonElement | null>(null)

// beside the map, the panel is as tall as the tools and map together. the
// tools can wrap to more lines in some languages, so it's measured
const card = ref<HTMLDivElement | null>(null)
const cardHeight = ref(0)
const panelHeight = computed(() =>
  props.side && cardHeight.value
    ? { maxHeight: `${cardHeight.value}px`, minHeight: `${cardHeight.value}px` }
    : undefined,
)
let cardWatch: ResizeObserver | null = null
const filtersOpen = ref(false)
const chosenTypes = ref<PlaceType[]>([])
const places = ref<Place[] | null>(null)
const placesFailed = ref(false)

const byId = computed(() => new Map(props.suburbs.map((item) => [item.id, item])))
const selected = computed(() => (selectedId.value ? byId.value.get(selectedId.value) : undefined))
const hasNoRent = computed(() => props.suburbs.some((item) => item.status === 'noData'))
const hasNoScore = computed(() => props.suburbs.some((item) => item.match === null))

// the middle of the chosen suburb, where its label sits, for the distances
const centre = computed(() => {
  const feature = features.find((item) => item.properties.suburb_id === selectedId.value)
  return feature ? { lat: feature.properties.label_lat, lon: feature.properties.label_lon } : null
})

// the chosen places, nearest the middle first, for the list under the map
const shownPlaces = computed(() => {
  if (!places.value || !centre.value) return []
  const from = centre.value
  return places.value
    .filter((place) => chosenTypes.value.includes(place.type))
    .map((place) => ({ place, km: distanceKm(from, place) }))
    .sort((a, b) => a.km - b.km)
})

// how current the figures behind the colours are, from the same list as the
// How it works page until Gold carries its own dates
// ranked suburbs first in rank order, then everything else by name
const pickerOptions = computed(() =>
  [...props.suburbs].sort(
    (a, b) =>
      (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
  ),
)

// colours come from tokens.css so the palette is defined once. SVG attributes
// can't read var(), hence reading the computed value
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function styleFor(id: string | undefined): L.PathOptions {
  const item = id ? byId.value.get(id) : undefined
  const step = bandFor(item?.row.overall_score ?? null)
  const isSelected = id !== undefined && id === selectedId.value
  const noRent = item?.status === 'noData'
  if (display.mapContrast) {
    // this stroke is the white either side of the edge. the black middle is
    // the edges layer on top
    return {
      color: '#ffffff',
      weight: isSelected ? 12 : 7,
      opacity: 1,
      fillOpacity: showStreets.value ? 0.8 : 1,
      fillColor: step === undefined ? 'url(#nr-hatch)' : token(`--nr-map-hc-${step}`),
    }
  }
  return {
    color: token('--nr-map-line'),
    weight: isSelected ? 4 : noRent ? 1.25 : 0.75,
    dashArray: noRent && !isSelected ? '4 3' : undefined,
    opacity: 1,
    fillOpacity: showStreets.value ? 0.65 : 1,
    fillColor: step === undefined ? 'url(#nr-hatch)' : token(`--nr-map-${step}`),
  }
}

// the black middle of each high contrast edge. hidden otherwise
function edgeFor(id: string | undefined): L.PathOptions {
  if (!display.mapContrast) return { stroke: false, fill: false }
  const isSelected = id !== undefined && id === selectedId.value
  const noRent = id ? byId.value.get(id)?.status === 'noData' : false
  return {
    stroke: true,
    fill: false,
    color: '#000000',
    weight: isSelected ? 6 : 3,
    opacity: 1,
    dashArray: noRent && !isSelected ? '4 3' : undefined,
  }
}

function restyle() {
  shapes?.setStyle((feature) => styleFor(feature?.properties.suburb_id))
  edges?.setStyle((feature) => edgeFor(feature?.properties.suburb_id))
  layerFor(selectedId.value)?.bringToFront()
  layerFor(selectedId.value, edges)?.bringToFront()
}

// the diagonal hatching for a suburb with no score at all. Leaflet has no
// pattern fills, so the pattern goes into its SVG once and paths point at it
function addHatch(svg: SVGSVGElement) {
  // rebuilt whenever the theme changes, since the fills come from tokens
  svg.querySelector('defs.nr-defs')?.remove()
  const ns = 'http://www.w3.org/2000/svg'
  const defs = document.createElementNS(ns, 'defs')
  defs.setAttribute('class', 'nr-defs')
  const pattern = document.createElementNS(ns, 'pattern')
  pattern.setAttribute('id', 'nr-hatch')
  pattern.setAttribute('width', '8')
  pattern.setAttribute('height', '8')
  pattern.setAttribute('patternUnits', 'userSpaceOnUse')
  pattern.setAttribute('patternTransform', 'rotate(45)')
  const background = document.createElementNS(ns, 'rect')
  background.setAttribute('width', '8')
  background.setAttribute('height', '8')
  background.setAttribute('fill', token('--nr-map-bg'))
  const stripe = document.createElementNS(ns, 'line')
  stripe.setAttribute('x1', '0')
  stripe.setAttribute('y1', '0')
  stripe.setAttribute('x2', '0')
  stripe.setAttribute('y2', '8')
  stripe.setAttribute('stroke', token('--nr-ink-muted'))
  stripe.setAttribute('stroke-width', '2')
  pattern.append(background, stripe)
  defs.append(pattern)
  svg.prepend(defs)
}

function layerFor(
  id: string | null | undefined,
  group: L.GeoJSON<BoundaryProperties> | null = shapes,
): L.Polygon | undefined {
  if (!id) return undefined
  let found: L.Polygon | undefined
  group?.eachLayer((layer) => {
    const feature = (layer as L.Polygon).feature as
      Feature<Geometry, BoundaryProperties> | undefined
    if (feature?.properties.suburb_id === id) found = layer as L.Polygon
  })
  return found
}

// built with DOM nodes rather than an HTML string, so a suburb name can never
// be read as markup
function tooltipFor(item: SuburbResult): HTMLElement {
  const box = document.createElement('div')
  const name = document.createElement('strong')
  name.textContent = item.name
  box.append(name)
  if (item.match !== null) {
    const match = document.createElement('div')
    match.className = 'map-tip__match'
    match.textContent = t('map.match', { score: item.match })
    box.append(match)
  }
  if (item.status === 'noData') {
    const note = document.createElement('div')
    note.className = 'map-tip__note'
    note.textContent = t('status.noData')
    box.append(note)
  }
  const list = document.createElement('dl')
  for (const topic of TOPICS) {
    const value = item.row[topic.score]
    if (typeof value !== 'number' || !props.counted.has(topic.id)) continue
    const row = document.createElement('div')
    const label = document.createElement('dt')
    label.textContent = t(`topics.${topic.key}`)
    const score = document.createElement('dd')
    score.textContent = String(Math.round(value))
    row.append(label, score)
    list.append(row)
  }
  box.append(list)
  return box
}

interface Placed {
  item: SuburbResult
  position: L.LatLng
  point: L.Point
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface Group {
  members: Placed[]
  // pixels moved down to clear a pin
  drop: number
}

// best first: the household's own ranking, then the rest by score
function byPriority(a: Placed, b: Placed): number {
  return (
    (a.item.rank ?? Number.MAX_SAFE_INTEGER) - (b.item.rank ?? Number.MAX_SAFE_INTEGER) ||
    (b.item.match ?? -1) - (a.item.match ?? -1)
  )
}

let measure: CanvasRenderingContext2D | null = null

function textWidth(text: string, size: number, weight: number): number {
  measure ??= document.createElement('canvas').getContext('2d')
  if (!measure) return text.length * size * 0.6
  measure.font = `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`
  return measure.measureText(text).width
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function boxAround(point: L.Point, width: number, height: number): Box {
  return {
    x: point.x - width / 2 - LABEL_GAP,
    y: point.y - height / 2 - LABEL_GAP,
    width: width + LABEL_GAP * 2,
    height: height + LABEL_GAP * 2,
  }
}

function scoreElement(item: SuburbResult, named: boolean, drop: number): HTMLElement {
  const pill = document.createElement('span')
  pill.className = 'map-label'
  if (drop) pill.style.marginTop = `${drop}px`
  if (named) {
    const name = document.createElement('span')
    name.className = 'map-label__name'
    name.textContent = item.name
    pill.append(name)
  }
  const score = document.createElement('span')
  score.textContent = String(item.match)
  pill.append(score)
  return pill
}

// the Layers icon from Lucide, drawn by hand because Leaflet labels are plain
// DOM rather than Vue components
const LAYERS_PATHS = [
  'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
  'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65',
  'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65',
]

function layersIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '13')
  svg.setAttribute('height', '13')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2.5')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  for (const d of LAYERS_PATHS) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}

// a stack icon and the count in words, so it can't be read as a score
function groupElement(count: number, drop: number): HTMLElement {
  const pill = document.createElement('span')
  pill.className = 'map-group'
  if (drop) pill.style.marginTop = `${drop}px`
  const words = document.createElement('span')
  words.textContent = t('map.groupCount', { n: count })
  pill.append(layersIcon(), words)
  return pill
}

function pinElement(item: SuburbResult, named: boolean, lift: number, small: boolean): HTMLElement {
  const pin = document.createElement('span')
  pin.className = named ? 'map-pin map-pin--named' : small ? 'map-pin map-pin--small' : 'map-pin'
  if (lift) pin.style.marginTop = `${-lift}px`
  const rank = document.createElement('span')
  rank.className = 'map-pin__rank'
  rank.textContent = String(item.rank)
  pin.append(rank)
  if (named) {
    const name = document.createElement('span')
    name.className = 'map-pin__name'
    name.textContent = `${item.name} ${item.match ?? ''}`.trim()
    pin.append(name)
  }
  return pin
}

// the lowest and highest score in a group. an average hides a 60 and an 89
// behind a 75
function range(group: Placed[]): { low: number; high: number } {
  const scores = group.map((entry) => entry.item.match ?? 0)
  return { low: Math.min(...scores), high: Math.max(...scores) }
}

/* labels by zoom.
   - the household's top 10 are numbered pins, the same numbers as the list,
     shown at every zoom and never folded into a group. names join them once
     there's room. a pin that would sit right on another lifts one step
   - every other suburb, best first, either starts a label or joins the label
     whose area it falls in. each label owns an area a little bigger than the
     widest label, so labels never overlap and groups can't snowball. a label
     with more than one suburb shows how many, with their range of scores in
     its hover text. zooming in spreads suburbs apart, so groups split until
     every suburb has its own score. selecting a group zooms into it */
function refreshLabels() {
  if (!map || !labels) return
  labels.clearLayers()
  const zoom = map.getZoom()
  const named = zoom >= NAME_ZOOM
  const pinsNamed = zoom >= PIN_NAME_ZOOM
  const view = map.getBounds().pad(0.1)
  const pins: Placed[] = []
  const others: Placed[] = []

  for (const feature of features) {
    const item = byId.value.get(feature.properties.suburb_id)
    if (!item || item.match === null) continue
    const position = L.latLng(feature.properties.label_lat, feature.properties.label_lon)
    if (!view.contains(position)) continue
    const entry = { item, position, point: map.latLngToContainerPoint(position) }
    if (item.rank !== null && item.rank <= TOP_PINS) pins.push(entry)
    else others.push(entry)
  }
  pins.sort(byPriority)
  others.sort(byPriority)

  const pinBoxes: Box[] = []
  for (const entry of pins) {
    // pins are 31px across once their border and padding are counted
    const small = zoom < SMALL_PIN_ZOOM
    const width = pinsNamed
      ? 50 + textWidth(`${entry.item.name} ${entry.item.match}`, 13, 700)
      : small
        ? 24
        : 34
    let lift = 0
    const height = small ? 24 : PIN_HEIGHT
    let box = boxAround(entry.point, width, height)
    if (pinBoxes.some((placed) => overlaps(placed, box))) {
      lift = height + 2
      box = boxAround(L.point(entry.point.x, entry.point.y - lift), width, height)
    }
    pinBoxes.push(box)
    labels.addLayer(
      L.marker(entry.position, {
        icon: L.divIcon({
          className: 'map-label-anchor',
          html: pinElement(entry.item, pinsNamed, lift, zoom < SMALL_PIN_ZOOM),
          iconSize: [0, 0],
        }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000 - (entry.item.rank ?? 0),
      }),
    )
  }

  const area = named ? NAMED_AREA : zoom < OVERVIEW_ZOOM ? OVERVIEW_AREA : SCORE_AREA
  const groups: Group[] = []
  const nearest = (point: L.Point) =>
    groups.reduce((best, group) =>
      group.members[0]!.point.distanceTo(point) < best.members[0]!.point.distanceTo(point)
        ? group
        : best,
    )

  for (const entry of others) {
    const home = groups.find(
      (group) =>
        Math.abs(group.members[0]!.point.x - entry.point.x) < area.width &&
        Math.abs(group.members[0]!.point.y + group.drop - entry.point.y) < area.height,
    )
    if (home) {
      home.members.push(entry)
      continue
    }
    // a new label can't sit on a pin: it drops below, or joins the nearest label
    let drop = 0
    const under = () =>
      pinBoxes.some((pin) =>
        overlaps(
          pin,
          boxAround(L.point(entry.point.x, entry.point.y + drop), area.width, LABEL_HEIGHT),
        ),
      )
    if (under()) drop = PIN_HEIGHT
    // once dropped it might land in another label's area, so check again
    const landed = groups.find(
      (group) =>
        Math.abs(group.members[0]!.point.x - entry.point.x) < area.width &&
        Math.abs(group.members[0]!.point.y + group.drop - (entry.point.y + drop)) < area.height,
    )
    if (landed) {
      landed.members.push(entry)
      continue
    }
    if (under() && groups.length) {
      nearest(entry.point).members.push(entry)
      continue
    }
    groups.push({ members: [entry], drop })
  }

  for (const group of groups) {
    const lead = group.members[0]!
    const many = group.members.length > 1
    const marker = L.marker(lead.position, {
      icon: L.divIcon({
        className: 'map-label-anchor',
        html: many
          ? groupElement(group.members.length, group.drop)
          : scoreElement(lead.item, named, group.drop),
        iconSize: [0, 0],
      }),
      interactive: many,
      keyboard: false,
      title: many ? t('map.groupTitle', { n: group.members.length, ...range(group.members) }) : '',
    })
    if (many) {
      marker.on('click', () => {
        const bounds = L.latLngBounds(group.members.map((entry) => entry.position))
        map?.fitBounds(bounds.pad(0.3), { maxZoom: (map?.getZoom() ?? 10) + 2 })
      })
    }
    labels.addLayer(marker)
  }
}

// room at the top for the zoom hint
function fitPadding(): L.FitBoundsOptions {
  return { paddingTopLeft: [24, 48], paddingBottomRight: [24, 24] }
}

// start on the suburbs that matter: the top three, close enough to read
function fitToTop() {
  if (!map || !shapes) return
  const top = props.suburbs.filter((item) => item.rank !== null && item.rank <= 3)
  const bounds = L.latLngBounds([])
  for (const item of top) {
    const layer = layerFor(item.id)
    if (layer) bounds.extend(layer.getBounds())
  }
  map.fitBounds(bounds.isValid() ? bounds.pad(0.2) : shapes.getBounds(), {
    ...fitPadding(),
    maxZoom: 12,
  })
}

function pick(id: string) {
  selectedId.value = id
  const layer = layerFor(id)
  if (map && layer) map.fitBounds(layer.getBounds(), { ...fitPadding(), maxZoom: 13 })
}

// from a card: the same as clicking the suburb on the map, then focus moves to
// its panel so a screen reader hears which suburb opened
async function showSuburb(id: string) {
  pick(id)
  await nextTick()
  panelHeading.value?.focus()
}

/* no zooming out past the whole of Melbourne, and no dragging off into empty
   space. worked out from the shapes and the map's size, and again on resize */
function limitView() {
  if (!map || !shapes) return
  const all = shapes.getBounds()
  map.setMaxBounds(all.pad(0.25))
  map.setMinZoom(Math.max(Math.floor(map.getBoundsZoom(all) * 2) / 2 - 0.5, 7))
}

// the same as Iris: scroll zoom switches on with a click and off when the
// pointer or focus leaves, so scrolling the page never gets caught by the map
function armZoom() {
  map?.scrollWheelZoom.enable()
  zoomArmed.value = true
}

function disarmZoom() {
  map?.scrollWheelZoom.disable()
  zoomArmed.value = false
}

// a lucide icon as a plain element, for markup Leaflet builds itself
function iconElement(icon: Component, size: number): Element {
  const holder = document.createElement('span')
  render(h(icon, { size, 'aria-hidden': 'true' }), holder)
  const svg = holder.firstElementChild!.cloneNode(true) as Element
  render(null, holder)
  return svg
}

const placeName = (place: Place) => place.name ?? t(`places.types.${place.type}`)

// the type, unless it's already the name, then how far
function placeAbout(place: Place, distance: number): string {
  const far = t('places.distance', {
    km: km(Math.round(distance * 10) / 10),
    suburb: selected.value?.name ?? '',
  })
  return place.name ? `${t(`places.types.${place.type}`)} · ${far}` : far
}

function popupFor(place: Place, distance: number): HTMLElement {
  const box = document.createElement('div')
  const name = document.createElement('strong')
  name.textContent = placeName(place)
  const about = document.createElement('span')
  about.className = 'place-popup__about'
  about.textContent = placeAbout(place, distance)
  box.append(name, about)
  return box
}

/* the pins only take clicks and taps. a pin each for the keyboard would be
   hundreds of tab stops, so the list under the map is the keyboard and screen
   reader way in, the same as the suburb picker is for the suburbs */
function drawPlaces() {
  if (!map || !placePins) return
  placePins.clearLayers()
  for (const { place, km: distance } of shownPlaces.value) {
    const group = GROUP_OF[place.type]
    const pin = document.createElement('span')
    pin.className = `place-pin place-pin--${group.id}`
    pin.append(iconElement(group.icon, 16))
    L.marker([place.lat, place.lon], {
      pane: 'nr-places',
      keyboard: false,
      icon: L.divIcon({ html: pin, className: 'place-pin-anchor', iconSize: [28, 28] }),
    })
      .bindPopup(() => popupFor(place, distance), { className: 'place-popup', offset: [0, -10] })
      .addTo(placePins)
  }
  const credit = t('places.credit')
  map.attributionControl.removeAttribution(credit)
  if (shownPlaces.value.length) map.attributionControl.addAttribution(credit)
}

// only fetched once the panel opens or something's chosen, so people who
// never use it don't download anything
async function refreshPlaces() {
  const id = selectedId.value
  if (!id || (!filtersOpen.value && !chosenTypes.value.length)) {
    drawPlaces()
    return
  }
  placesFailed.value = false
  try {
    const loaded = await loadPlaces(id)
    if (selectedId.value !== id) return
    places.value = loaded
  } catch {
    if (selectedId.value === id) placesFailed.value = true
  }
  drawPlaces()
}

// with no suburb open yet, it starts on the best match, so the button always
// does something
function toggleNearby() {
  if (filtersOpen.value) {
    filtersOpen.value = false
    return
  }
  if (!selectedId.value) {
    const first = pickerOptions.value[0]
    if (!first) return
    pick(first.id)
  }
  filtersOpen.value = true
}

async function closeFilters() {
  filtersOpen.value = false
  await nextTick()
  placesButton.value?.focus()
}

async function closePanel() {
  selectedId.value = null
  await nextTick()
  picker.value?.focus()
}

onMounted(async () => {
  try {
    const data = await loadBoundaries()
    if (!container.value) return
    features = data.features

    map = L.map(container.value, {
      scrollWheelZoom: false,
      zoomSnap: 0.5,
      maxBoundsViscosity: 1,
    })
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')

    shapes = L.geoJSON<BoundaryProperties>(data, {
      attribution: t('map.boundariesCredit'),
      style: (feature) => styleFor(feature?.properties.suburb_id),
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          selectedId.value = feature.properties.suburb_id
        })
        if (canHover) {
          layer.bindTooltip(
            () => {
              const item = byId.value.get(feature.properties.suburb_id)
              return item ? tooltipFor(item) : document.createElement('span')
            },
            { sticky: true, direction: 'top', className: 'map-tip', offset: [0, -8] },
          )
        }
      },
    }).addTo(map)
    // own pane so a suburb brought to the front can't cover the edges. clicks
    // go through to the suburb underneath
    const edgePane = map.createPane('nr-edges')
    edgePane.style.zIndex = '450'
    edgePane.style.pointerEvents = 'none'
    edges = L.geoJSON<BoundaryProperties>(data, {
      pane: 'nr-edges',
      interactive: false,
      style: (feature) => edgeFor(feature?.properties.suburb_id),
    }).addTo(map)
    labels = L.layerGroup().addTo(map)
    // above the score labels, so a pin is never hidden under one
    map.createPane('nr-places').style.zIndex = '650'
    placePins = L.layerGroup().addTo(map)

    // Leaflet holds layers back until the map has a view, so the SVG the
    // hatching goes into only exists after the first fit
    fitToTop()
    const svg = container.value.querySelector('svg')
    if (svg) addHatch(svg)

    limitView()
    map.on('resize', limitView)
    map.on('moveend zoomend', refreshLabels)
    map.on('click focus', armZoom)
    map.on('mouseout blur', disarmZoom)
    refreshLabels()
    state.value = 'ready'
    if (props.focus) showSuburb(props.focus.id)
  } catch {
    state.value = 'error'
  }
})

onMounted(() => {
  if (!card.value || typeof ResizeObserver === 'undefined') return
  cardWatch = new ResizeObserver(([entry]) => {
    // unrounded, so the two bottoms line up to the pixel
    cardHeight.value = entry?.borderBoxSize?.[0]?.blockSize ?? card.value?.offsetHeight ?? 0
  })
  cardWatch.observe(card.value)
})

onBeforeUnmount(() => {
  cardWatch?.disconnect()
  map?.remove()
  map = null
})

watch(selectedId, (id, before) => {
  restyle()
  if (id !== before) places.value = null
  if (!id) filtersOpen.value = false
  refreshPlaces()
})
watch([filtersOpen, chosenTypes], refreshPlaces)
// the theme changes the hatch colours, so rebuild it, then recolour
watch(
  () => [display.mapContrast, display.theme],
  async () => {
    await nextTick()
    const svg = container.value?.querySelector('svg')
    if (svg) addHatch(svg)
    restyle()
  },
)
watch(
  () => props.focus,
  (focus) => {
    if (focus && state.value === 'ready') showSuburb(focus.id)
  },
)
watch(
  () => props.suburbs,
  () => {
    restyle()
    refreshLabels()
  },
)

/* street pictures from OpenStreetMap's volunteer servers. they need to know
   which site is asking, so the tiles send our address even though the rest
   of the site sends no referrer at all. desaturated so the suburb colours
   stay the thing you look at */
watch(showStreets, (on) => {
  if (!map) return
  if (on) {
    tiles ??= L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      referrerPolicy: 'strict-origin-when-cross-origin',
      className: 'suburb-map__tiles',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
    tiles.addTo(map)
  } else {
    tiles?.remove()
  }
  restyle()
})

function onPick(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  if (id) pick(id)
}
</script>

<template>
  <div class="suburb-map" :class="{ 'suburb-map--side': side }">
    <div class="suburb-map__main">
      <!-- the tools and the map share one card, the tools as its top edge,
           so they read as part of the map without covering any of it. three
           plain buttons rather than a settings menu, so each is one tap or
           key away and says what it does. the tips show on hover and focus,
           and screen readers get the same words as a description -->
      <div ref="card" class="suburb-map__card">
        <div v-if="state === 'ready'" class="map-tools" role="group" :aria-label="t('map.tools')">
          <div class="map-tool-wrap">
            <button
              type="button"
              class="map-tool"
              :aria-pressed="showStreets ? 'true' : 'false'"
              aria-describedby="map-tip-streets"
              @click="showStreets = !showStreets"
            >
              <Layers class="map-tool__icon" :size="20" aria-hidden="true" />
              <span class="map-tool__label">{{ t('map.streets') }}</span>
              <span class="map-tool__state">{{
                showStreets ? t('map.contrastOn') : t('map.contrastOff')
              }}</span>
            </button>
            <span id="map-tip-streets" class="map-tool__tip">{{ t('map.streetsTip') }}</span>
          </div>
          <MapContrastToggle />
          <div class="map-tool-wrap">
            <button
              ref="placesButton"
              type="button"
              class="map-tool"
              :aria-expanded="filtersOpen ? 'true' : 'false'"
              aria-controls="place-filters"
              aria-describedby="map-tip-nearby"
              @click="toggleNearby"
            >
              <MapPin class="map-tool__icon" :size="20" aria-hidden="true" />
              <span class="map-tool__label">{{ t('places.button') }}</span>
              <span class="map-tool__state">{{
                shownPlaces.length
                  ? t('places.shown', { n: shownPlaces.length })
                  : t('map.contrastOff')
              }}</span>
            </button>
            <span id="map-tip-nearby" class="map-tool__tip">{{ t('places.tip') }}</span>
          </div>
        </div>

        <div class="suburb-map__frame">
          <div
            ref="container"
            class="suburb-map__canvas"
            role="region"
            :aria-label="t('map.label')"
            aria-describedby="map-legend-title"
          ></div>
          <p v-if="state === 'loading'" class="suburb-map__status">{{ t('map.loading') }}</p>
          <p v-if="state === 'error'" class="suburb-map__status" role="alert">
            {{ t('map.error') }}
          </p>

          <PlaceFilters
            v-if="filtersOpen && selected"
            v-model="chosenTypes"
            :suburb="selected.name"
            :places="places"
            :failed="placesFailed"
            @close="closeFilters"
          />

          <!-- a mouse instruction, so hidden from screen readers. keyboard users
             have the + and - buttons and touch users pinch -->
          <p
            v-if="state === 'ready' && canHover && !zoomArmed"
            class="suburb-map__zoom-hint"
            aria-hidden="true"
          >
            {{ t('map.clickToZoom') }}
          </p>
        </div>
      </div>

      <div class="suburb-map__below">
        <div class="suburb-map__picker">
          <label for="map-pick" class="field__label">{{ t('map.pick') }}</label>
          <select
            id="map-pick"
            ref="picker"
            :value="selectedId ?? ''"
            aria-describedby="map-streets-hint"
            @change="onPick"
          >
            <option v-for="item in pickerOptions" :key="item.id" :value="item.id">
              {{ item.rank ? `${item.rank}. ${item.name}` : item.name }}
              ({{ t(`status.${item.status}`) }})
            </option>
          </select>
          <p id="map-streets-hint" class="field__hint suburb-map__pick-hint">
            {{ t('map.notes') }}
          </p>
        </div>
        <MapLegend :show-no-rent="hasNoRent" :show-no-score="hasNoScore" />
      </div>

      <details v-if="selected && shownPlaces.length" class="suburb-map__place-list">
        <summary>
          {{ t('places.list', shownPlaces.length) }}
        </summary>
        <!-- focusable, since it scrolls on its own -->
        <ul tabindex="0" :aria-label="t('places.list', shownPlaces.length)">
          <li
            v-for="{ place, km: distance } in shownPlaces"
            :key="`${place.type}${place.lat}${place.lon}`"
          >
            <span
              class="place-pin"
              :class="`place-pin--${GROUP_OF[place.type].id}`"
              aria-hidden="true"
            >
              <component :is="GROUP_OF[place.type].icon" :size="14" />
            </span>
            <span>
              <strong>{{ placeName(place) }}</strong>
              <span class="suburb-map__place-about">{{ placeAbout(place, distance) }}</span>
            </span>
          </li>
        </ul>
        <p class="field__hint">{{ t('places.credit') }}</p>
      </details>
    </div>

    <aside v-if="selected" class="suburb-map__panel" :style="panelHeight" aria-live="polite">
      <header class="suburb-map__panel-head">
        <div class="suburb-map__panel-title">
          <h2 ref="panelHeading" class="suburb-map__name" tabindex="-1">{{ selected.name }}</h2>
          <p class="suburb-map__rank-line">
            {{
              selected.rank
                ? t('suburb.ranked', { rank: selected.rank, total })
                : t('map.notRanked')
            }}
          </p>
        </div>
        <button
          type="button"
          class="suburb-map__close"
          :aria-label="t('map.close', { suburb: selected.name })"
          @click="closePanel"
        >
          <X :size="22" aria-hidden="true" />
        </button>
        <p v-if="selected.match !== null" class="suburb-map__score">
          <span class="suburb-map__score-value">{{ selected.match }}</span>
          <span>{{ t('map.matchOutOf') }}</span>
        </p>
        <BudgetBadge :status="selected.status" />
      </header>
      <div class="suburb-map__panel-body">
        <TopicBars :suburb="selected" :counted="counted" :has-language="hasLanguage" compact />
        <RouterLink
          :to="{ name: 'suburb', params: { id: selected.id } }"
          class="suburb-map__details"
        >
          {{ t('map.details') }}
          <span class="visually-hidden">{{
            t('results.detailsFor', { suburb: selected.name })
          }}</span>
        </RouterLink>
        <!-- a reason to open the filters, where people are already looking -->
        <div v-if="!filtersOpen" class="suburb-map__nearby">
          <p>{{ t('places.prompt', { suburb: selected.name }) }}</p>
          <button type="button" class="btn btn--outline" @click="filtersOpen = true">
            <MapPin :size="20" aria-hidden="true" />
            {{ shownPlaces.length ? t('places.change') : t('places.open') }}
          </button>
        </div>
      </div>
    </aside>
    <aside v-else-if="side" class="suburb-map__panel suburb-map__panel--empty" :style="panelHeight">
      <p>{{ t('map.pickPrompt') }}</p>
    </aside>
  </div>
</template>

<style scoped>
.suburb-map__frame {
  position: relative;
}

/* isolation keeps Leaflet's own z-indexes (up to 1000) inside the map, so
   its panes and zoom buttons can't slide over the sticky header or action bar */
.suburb-map__card {
  border: 2px solid var(--nr-line);
  border-radius: var(--nr-radius);
  background: var(--nr-map-bg);
  overflow: hidden;
}

.suburb-map__canvas {
  isolation: isolate;
  height: clamp(22rem, 62vh, 36rem);
  background: var(--nr-map-bg);
  overflow: hidden;
}

.suburb-map__status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 1rem;
  text-align: center;
  font-weight: 700;
}

/* the street map and contrast switches sit on the map, top right, like a
   layers button */
.suburb-map__nearby {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--nr-line);
}

.suburb-map__nearby p {
  margin: 0 0 0.5rem;
}

/* the same places as the pins, nearest first, for keyboards and screen
   readers. closed to start, since it can run to a few hundred */
.suburb-map__place-list {
  margin-top: 1rem;
  border: 2px solid var(--nr-line);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-surface-raised);
}

.suburb-map__place-list summary {
  display: flex;
  align-items: center;
  min-height: var(--nr-target);
  padding: 0 1rem;
  color: var(--nr-wine-text);
  font-weight: 700;
  cursor: pointer;
}

.suburb-map__place-list ul {
  max-height: 24rem;
  margin: 0;
  padding: 0 1rem;
  overflow-y: auto;
  list-style: none;
}

.suburb-map__place-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding-block: 0.5rem;
  border-top: 1px solid var(--nr-line);
}

.suburb-map__place-list .place-pin {
  width: 1.5rem;
  height: 1.5rem;
}

.suburb-map__place-about {
  display: block;
  color: var(--nr-ink-muted);
  font-size: 0.9375rem;
}

.suburb-map__place-list .field__hint {
  margin: 0;
  padding: 0.5rem 1rem 0.75rem;
}

/* top centre, clear of the legend in the bottom corner */
.suburb-map__zoom-hint {
  position: absolute;
  top: 0.9rem;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
  margin: 0;
  padding: 0.35rem 0.9rem;
  border-radius: var(--nr-radius-pill);
  background: rgb(48 38 34 / 0.85);
  color: var(--nr-cream);
  font-size: 0.875rem;
  white-space: nowrap;
  pointer-events: none;
}

.suburb-map__below {
  display: grid;
  gap: 1.25rem;
  margin-top: 1rem;
}

/* our own chevron instead of the browser's tiny one, with room so the
   longest suburb name never runs under it. wine, the same as the links */
.suburb-map__picker select {
  width: 100%;
  min-height: var(--nr-target);
  padding-inline: 0.85rem 2.75rem;
  border: 2px solid var(--nr-border-strong);
  border-radius: var(--nr-radius-sm);
  background-color: var(--nr-surface-raised);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237b282b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-position: right 0.85rem center;
  background-repeat: no-repeat;
  background-size: 1.25rem;
  color: var(--nr-ink);
  font: inherit;
  font-size: 1.0625rem;
  text-overflow: ellipsis;
  appearance: none;
  cursor: pointer;
}

:global([dir='rtl']) .suburb-map__picker select {
  background-position: left 0.85rem center;
}

.suburb-map__pick-hint {
  margin: 0.5rem 0 0;
}

/* the panel, after the data team's: a wine header with the name and the
   match, then the topic bars */
.suburb-map__panel {
  margin-top: 1.5rem;
  border: 2px solid var(--nr-wine-line);
  border-radius: var(--nr-radius);
  background: var(--nr-surface-raised);
  overflow: hidden;
}

.suburb-map__panel--empty {
  display: grid;
  place-items: center;
  padding: 1.5rem;
  border-style: dashed;
  border-color: var(--nr-line);
  color: var(--nr-ink-muted);
  text-align: center;
}

.suburb-map__panel-head {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 0.5rem 0.75rem;
  padding: 1.1rem 1.25rem 1.25rem;
  background: var(--nr-wine);
  color: var(--nr-cream);
}

.suburb-map__name:focus {
  outline: none;
}

.suburb-map__panel-head > .badge {
  grid-column: 1 / -1;
  justify-self: start;
}

.suburb-map__name {
  margin: 0;
  color: var(--nr-cream);
  font-size: 1.5rem;
}

.suburb-map__rank-line {
  margin: 0.15rem 0 0;
  color: var(--nr-apricot);
}

.suburb-map__close {
  display: inline-grid;
  place-items: center;
  width: var(--nr-target);
  height: var(--nr-target);
  border: 0;
  border-radius: 50%;
  background: rgb(255 250 245 / 0.16);
  color: var(--nr-cream);
  cursor: pointer;
}

.suburb-map__close:hover {
  background: rgb(255 250 245 / 0.28);
}

.suburb-map__close:focus-visible {
  outline-color: var(--nr-focus-on-dark);
}

.suburb-map__score {
  grid-column: 1 / -1;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0;
}

.suburb-map__score-value {
  font-size: 2.75rem;
  font-weight: 700;
  line-height: 1;
}

.suburb-map__panel-body {
  padding: 0.5rem 1.25rem 1rem;
}

.suburb-map__details {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
  font-weight: 700;
}

/* a big map with the panel beside it, the same height, on a wide screen */
.suburb-map--side {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22rem;
  align-items: start;
  gap: 1.5rem;
}

.suburb-map--side .suburb-map__canvas {
  height: clamp(30rem, 72vh, 44rem);
}

.suburb-map--side .suburb-map__panel {
  position: sticky;
  top: calc(var(--nr-header-height) + 1rem);
  margin: 0;
  overflow-y: auto;
}

.suburb-map--side .suburb-map__panel--empty {
  height: clamp(30rem, 72vh, 44rem);
}
</style>

<style>
/* Leaflet builds this markup itself, so these can't be scoped */
.suburb-map .leaflet-container {
  font-family: var(--nr-font);
  background: var(--nr-map-bg);
}

.suburb-map .leaflet-nr-edges-pane svg {
  /* leaflet only lifts the global svg max-width for its own panes */
  max-width: none !important;
  max-height: none !important;
}

.suburb-map .leaflet-container :focus-visible {
  outline: 3px solid var(--nr-focus);
}

/* Leaflet's zoom buttons are 30px, bring them up to the same target as everything else */
.suburb-map .leaflet-bar a {
  width: var(--nr-target);
  height: var(--nr-target);
  line-height: var(--nr-target);
  font-size: 1.5rem;
}

/* street pictures, greyed down so the suburb colours stay in front */
.suburb-map .suburb-map__tiles {
  filter: grayscale(1) contrast(0.9) brightness(1.05);
}

/* Safari rings a suburb's shape after a click or drag. the shapes aren't in
   the tab order (the picker under the map is the keyboard way in), so this
   only hides the ring a mouse or finger caused, never a keyboard one */
.suburb-map path.leaflet-interactive:focus:not(:focus-visible) {
  outline: none;
}

/* place pins sit centred on the place */
.suburb-map .place-pin-anchor {
  display: grid;
  place-items: center;
  background: none;
  border: 0;
}

.suburb-map .place-popup .leaflet-popup-content {
  margin: 0.65rem 0.9rem;
  font-size: 0.9375rem;
  line-height: 1.35;
}

/* the name, then the type and distance on a line of their own */
.suburb-map .place-popup strong {
  display: block;
}

.suburb-map .place-popup__about {
  display: block;
  margin-top: 0.2rem;
  color: #5c4a42;
}

/* score labels, centred on the data team's label point */
.suburb-map .map-label-anchor {
  overflow: visible;
}

.suburb-map .map-label {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  transform: translate(-50%, -50%);
  padding: 0.1rem 0.5rem;
  border: 2px solid var(--nr-espresso);
  border-radius: 999px;
  background: var(--nr-cream);
  color: var(--nr-espresso);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgb(48 38 34 / 0.25);
}

.suburb-map .map-label__name {
  font-weight: 600;
}

/* a group of suburbs that don't fit yet: a stack icon, a count and a dashed
   stacked look, so it can't be mistaken for one suburb's score */
.suburb-map .map-group {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  transform: translate(-50%, -50%);
  padding: 0.1rem 0.45rem;
  border: 2px dashed var(--nr-espresso);
  border-radius: 999px;
  background: var(--nr-apricot);
  color: var(--nr-espresso);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  box-shadow:
    3px 3px 0 -1px var(--nr-apricot),
    3px 3px 0 1px var(--nr-espresso);
  cursor: zoom-in;
}

/* the household's top 10, numbered the same as the list */
.suburb-map .map-pin {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transform: translate(-50%, -50%);
  padding: 0.15rem;
  border: 2px solid var(--nr-cream);
  border-radius: 999px;
  background: var(--nr-wine);
  color: var(--nr-cream);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgb(48 38 34 / 0.35);
}

.suburb-map .map-pin__rank {
  display: inline-grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--nr-cream);
  color: var(--nr-wine-text);
}

.suburb-map .map-pin--named {
  padding-inline-end: 0.6rem;
}

.suburb-map .map-pin--small {
  padding: 0.05rem;
  border-width: 1.5px;
  font-size: 0.6875rem;
}

.suburb-map .map-pin--small .map-pin__rank {
  width: 1.05rem;
  height: 1.05rem;
}

.leaflet-tooltip.map-tip {
  padding: 0.6rem 0.75rem;
  border: 2px solid var(--nr-wine-line);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-surface-raised);
  box-shadow: 0 4px 12px rgb(48 38 34 / 0.18);
  color: var(--nr-ink);
  font-family: var(--nr-font);
  font-size: 0.875rem;
  line-height: 1.35;
}

.map-tip strong {
  display: block;
  color: var(--nr-wine-text);
  font-size: 1rem;
}

.map-tip .map-tip__match {
  color: var(--nr-rust);
  font-weight: 700;
}

.map-tip .map-tip__note {
  color: var(--nr-ink-muted);
  font-weight: 700;
}

.map-tip dl {
  margin: 0.3rem 0 0;
}

.map-tip dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.map-tip dt,
.map-tip dd {
  margin: 0;
}

.map-tip dd {
  font-weight: 700;
}
</style>
