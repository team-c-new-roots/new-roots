<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Layers, X } from '@lucide/vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, Geometry } from 'geojson'
import type { TopicName } from '@/types'
import { loadBoundaries, type BoundaryProperties } from '@/services/boundaries'
import { bandFor, type SuburbResult } from '@/services/results'
import { TOPICS } from '@/data/topics'
import BudgetBadge from '@/components/ui/BudgetBadge.vue'
import TopicBars from './TopicBars.vue'
import MapLegend from './MapLegend.vue'

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
   - loaded on its own, so only people who open the map download Leaflet */

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
let labels: L.LayerGroup | null = null
let tiles: L.TileLayer | null = null
let features: Feature<Geometry, BoundaryProperties>[] = []

const byId = computed(() => new Map(props.suburbs.map((item) => [item.id, item])))
const selected = computed(() => (selectedId.value ? byId.value.get(selectedId.value) : undefined))
const hasNoRent = computed(() => props.suburbs.some((item) => item.status === 'noData'))
const hasNoScore = computed(() => props.suburbs.some((item) => item.match === null))

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
  return {
    color: token('--nr-map-line'),
    weight: isSelected ? 4 : noRent ? 1.25 : 0.75,
    dashArray: noRent && !isSelected ? '4 3' : undefined,
    opacity: 1,
    fillOpacity: showStreets.value ? 0.65 : 1,
    fillColor: step === undefined ? 'url(#nr-hatch)' : token(`--nr-map-${step}`),
  }
}

function restyle() {
  shapes?.setStyle((feature) => styleFor(feature?.properties.suburb_id))
  layerFor(selectedId.value)?.bringToFront()
}

// the diagonal hatching for a suburb with no score at all. Leaflet has no
// pattern fills, so the pattern goes into its SVG once and paths point at it
function addHatch(svg: SVGSVGElement) {
  if (svg.querySelector('#nr-hatch')) return
  const ns = 'http://www.w3.org/2000/svg'
  const defs = document.createElementNS(ns, 'defs')
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

function layerFor(id: string | null | undefined): L.Polygon | undefined {
  if (!id) return undefined
  let found: L.Polygon | undefined
  shapes?.eachLayer((layer) => {
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

function average(group: Placed[]): number {
  return Math.round(group.reduce((sum, entry) => sum + (entry.item.match ?? 0), 0) / group.length)
}

/* labels by zoom.
   - the household's top 10 are numbered pins, the same numbers as the list,
     shown at every zoom and never folded into a group. names join them once
     there's room. a pin that would sit right on another lifts one step
   - every other suburb, best first, either starts a label or joins the label
     whose area it falls in. each label owns an area a little bigger than the
     widest label, so labels never overlap and groups can't snowball. a label
     with more than one suburb shows how many, with their average in its
     hover text. zooming in spreads suburbs apart, so groups split until
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
      title: many
        ? t('map.groupTitle', { n: group.members.length, average: average(group.members) })
        : '',
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

// room at the top for the street map switch and the zoom hint
function fitPadding(): L.FitBoundsOptions {
  return { paddingTopLeft: [24, 64], paddingBottomRight: [24, 24] }
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
    labels = L.layerGroup().addTo(map)

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

onBeforeUnmount(() => {
  map?.remove()
  map = null
})

watch(selectedId, restyle)
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
      <div class="suburb-map__frame">
        <div
          ref="container"
          class="suburb-map__canvas"
          role="region"
          :aria-label="t('map.label')"
          aria-describedby="map-legend-title"
        ></div>
        <p v-if="state === 'loading'" class="suburb-map__status">{{ t('map.loading') }}</p>
        <p v-if="state === 'error'" class="suburb-map__status" role="alert">{{ t('map.error') }}</p>

        <button
          v-if="state === 'ready'"
          type="button"
          class="suburb-map__streets"
          :aria-pressed="showStreets ? 'true' : 'false'"
          aria-describedby="map-streets-hint"
          @click="showStreets = !showStreets"
        >
          <Layers :size="18" aria-hidden="true" />
          {{ t('map.streets') }}
        </button>

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

      <div class="suburb-map__below">
        <div class="suburb-map__picker">
          <label for="map-pick" class="field__label">{{ t('map.pick') }}</label>
          <select id="map-pick" ref="picker" :value="selectedId ?? ''" @change="onPick">
            <option v-for="item in pickerOptions" :key="item.id" :value="item.id">
              {{ item.rank ? `${item.rank}. ${item.name}` : item.name }}
              ({{ t(`status.${item.status}`) }})
            </option>
          </select>
        </div>
        <MapLegend :show-no-rent="hasNoRent" :show-no-score="hasNoScore" />
        <p id="map-streets-hint" class="field__hint suburb-map__notes">
          {{ t('map.notes') }}
        </p>
      </div>
    </div>

    <aside v-if="selected" class="suburb-map__panel" aria-live="polite">
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
      </div>
    </aside>
    <aside v-else-if="side" class="suburb-map__panel suburb-map__panel--empty">
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
.suburb-map__canvas {
  isolation: isolate;
  height: clamp(22rem, 62vh, 36rem);
  border: 2px solid var(--nr-line);
  border-radius: var(--nr-radius);
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

/* the street map switch sits on the map, top right, like a layers button */
.suburb-map__streets {
  position: absolute;
  top: 0.75rem;
  inset-inline-end: 0.75rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--nr-target);
  padding: 0 1rem;
  border: 2px solid var(--nr-wine);
  border-radius: var(--nr-radius-pill);
  background: var(--nr-surface-raised);
  color: var(--nr-wine);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgb(48 38 34 / 0.18);
}

.suburb-map__streets:hover {
  background: var(--nr-apricot);
}

.suburb-map__streets[aria-pressed='true'] {
  background: var(--nr-wine);
  color: var(--nr-cream);
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

.suburb-map__picker select {
  width: 100%;
  min-height: var(--nr-target);
  padding-inline: 0.85rem;
  border: 2px solid var(--nr-border-strong);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-surface-raised);
  color: var(--nr-ink);
  font: inherit;
  font-size: 1.0625rem;
}

.suburb-map__notes {
  margin: 0;
}

/* the panel, after the data team's: a wine header with the name and the
   match, then the topic bars */
.suburb-map__panel {
  margin-top: 1.5rem;
  border: 2px solid var(--nr-wine);
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
  max-height: clamp(30rem, 72vh, 44rem);
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
  color: var(--nr-wine);
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
  border: 2px solid var(--nr-wine);
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
  color: var(--nr-wine);
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
