<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Layers, X } from '@lucide/vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, Geometry } from 'geojson'
import type { TopicName } from '@/types'
import { loadBoundaries, type BoundaryProperties } from '@/services/boundaries'
import type { SuburbResult } from '@/services/results'
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
}>()

const selectedId = defineModel<string | null>('selected', { default: null })

const { t } = useI18n()
const container = ref<HTMLElement | null>(null)
const picker = ref<HTMLSelectElement | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const showStreets = ref(false)
const zoomArmed = ref(false)
const canHover = window.matchMedia('(hover: hover)').matches

// names join the scores from this zoom in
const NAME_ZOOM = 12.5
// breathing room around each label, in pixels
const LABEL_GAP = 3
const TOP_STYLE = 10

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

// ramp step 1 to 5 by rank among every suburb with a score, so the map uses
// the whole ramp whatever the scores happen to be
const steps = computed(() => {
  const scored = props.suburbs
    .filter((item) => item.row.overall_score !== null)
    .sort((a, b) => (b.row.overall_score ?? 0) - (a.row.overall_score ?? 0))
  const result = new Map<string, number>()
  scored.forEach((item, index) => {
    result.set(item.id, 5 - Math.floor((index / scored.length) * 5))
  })
  return result
})

// colours come from tokens.css so the palette is defined once. SVG attributes
// can't read var(), hence reading the computed value
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function styleFor(id: string | undefined): L.PathOptions {
  const item = id ? byId.value.get(id) : undefined
  const step = id ? steps.value.get(id) : undefined
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
}

// best first: the household's own ranking, then the rest by score
function byPriority(a: Placed, b: Placed): number {
  return (
    (a.item.rank ?? Number.MAX_SAFE_INTEGER) - (b.item.rank ?? Number.MAX_SAFE_INTEGER) ||
    (b.item.match ?? -1) - (a.item.match ?? -1)
  )
}

// the household's top 10 always show their names, so the city view says
// where they are. everyone else gets a name once zoomed in to suburb level
function showsName(item: SuburbResult, zoomedIn: boolean): boolean {
  return zoomedIn || (item.rank !== null && item.rank <= TOP_STYLE)
}

function labelElement(lead: SuburbResult, more: number, named: boolean): HTMLElement {
  const pill = document.createElement('span')
  pill.className = 'map-label'
  if (lead.rank !== null && lead.rank <= TOP_STYLE) pill.classList.add('map-label--top')
  if (named) {
    const name = document.createElement('span')
    name.className = 'map-label__name'
    name.textContent = lead.name
    pill.append(name)
  }
  const score = document.createElement('span')
  score.className = 'map-label__score'
  score.textContent = String(lead.match)
  pill.append(score)
  if (more > 0) {
    const extra = document.createElement('span')
    extra.className = 'map-label__more'
    extra.textContent = `+${more}`
    pill.append(extra)
  }
  return pill
}

/* labels by zoom. best suburbs are placed first, and a label that would
   overlap one already placed joins the nearest one instead, which then shows
   a +count. zooming in spreads the suburbs apart, so the groups split until
   every suburb has its own label. tapping a group zooms into it. space is
   kept for a +count on every label, so adding one can't cause an overlap */
let measure: CanvasRenderingContext2D | null = null

function textWidth(text: string, size: number, weight: number): number {
  measure ??= document.createElement('canvas').getContext('2d')
  if (!measure) return text.length * size * 0.6
  measure.font = `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`
  return measure.measureText(text).width
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function refreshLabels() {
  if (!map || !labels) return
  labels.clearLayers()
  const named = map.getZoom() >= NAME_ZOOM
  const view = map.getBounds().pad(0.1)
  const candidates: (Placed & { point: L.Point })[] = []

  for (const feature of features) {
    const item = byId.value.get(feature.properties.suburb_id)
    if (!item || item.match === null) continue
    const position = L.latLng(feature.properties.label_lat, feature.properties.label_lon)
    if (!view.contains(position)) continue
    candidates.push({ item, position, point: map.latLngToContainerPoint(position) })
  }
  candidates.sort(byPriority)

  const placed: { lead: Placed; point: L.Point; box: Box; members: Placed[] }[] = []
  for (const candidate of candidates) {
    // pill padding and border, the score, room for a +count, and the name
    let width = 22 + textWidth(String(candidate.item.match), 13, 700) + 30
    if (showsName(candidate.item, named)) width += 6 + textWidth(candidate.item.name, 13, 600)
    const height = 26
    const box = {
      x: candidate.point.x - width / 2 - LABEL_GAP,
      y: candidate.point.y - height / 2 - LABEL_GAP,
      width: width + LABEL_GAP * 2,
      height: height + LABEL_GAP * 2,
    }
    const clash = placed.filter((entry) => overlaps(entry.box, box))
    if (clash.length === 0) {
      placed.push({ lead: candidate, point: candidate.point, box, members: [] })
      continue
    }
    const nearest = clash.reduce((best, entry) =>
      entry.point.distanceTo(candidate.point) < best.point.distanceTo(candidate.point)
        ? entry
        : best,
    )
    nearest.members.push(candidate)
  }

  for (const { lead, members } of placed) {
    const more = members.length
    const marker = L.marker(lead.position, {
      icon: L.divIcon({
        className: 'map-label-anchor',
        html: labelElement(lead.item, more, showsName(lead.item, named)),
        iconSize: [0, 0],
      }),
      interactive: more > 0,
      keyboard: false,
      title: more > 0 ? t('map.groupTitle', { suburb: lead.item.name, n: more }) : '',
    })
    if (more > 0) {
      marker.on('click', () => {
        const bounds = L.latLngBounds([lead.position, ...members.map((entry) => entry.position)])
        map?.fitBounds(bounds.pad(0.4), { maxZoom: (map?.getZoom() ?? 10) + 2 })
      })
    }
    labels.addLayer(marker)
  }
}

// on a wide screen the legend floats in the bottom corner, so fitting leaves
// room under the suburbs for it rather than tucking the top result behind it
function fitPadding(): L.FitBoundsOptions {
  const bottom = props.side ? 190 : 24
  return { paddingTopLeft: [24, 72], paddingBottomRight: [24, bottom] }
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

    map = L.map(container.value, { scrollWheelZoom: false, zoomSnap: 0.5 })
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

    map.on('moveend zoomend', refreshLabels)
    map.on('click focus', armZoom)
    map.on('mouseout blur', disarmZoom)
    refreshLabels()
    state.value = 'ready'
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

        <MapLegend
          v-if="side && state === 'ready'"
          floating
          :show-no-rent="hasNoRent"
          :show-no-score="hasNoScore"
        />
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
        <MapLegend v-if="!side" :show-no-rent="hasNoRent" :show-no-score="hasNoScore" />
        <p class="field__hint suburb-map__notes">
          {{ t('map.zoomHint') }}
          <span id="map-streets-hint">{{ t('map.streetsHint') }}</span>
        </p>
      </div>
    </div>

    <aside v-if="selected" class="suburb-map__panel" aria-live="polite">
      <header class="suburb-map__panel-head">
        <div class="suburb-map__panel-title">
          <h2 class="suburb-map__name">{{ selected.name }}</h2>
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
        <TopicBars :suburb="selected" :counted="counted" :has-language="hasLanguage" />
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

.suburb-map .map-label--top {
  border-color: var(--nr-cream);
  background: var(--nr-wine);
  color: var(--nr-cream);
}

.suburb-map .map-label__name {
  font-weight: 600;
}

.suburb-map .map-label__more {
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--nr-apricot);
  color: var(--nr-espresso);
  font-size: 0.75rem;
}

.suburb-map .leaflet-marker-icon.leaflet-interactive .map-label {
  cursor: zoom-in;
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
