<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, Geometry } from 'geojson'
import { loadBoundaries, type BoundaryProperties } from '@/services/boundaries'
import type { RankedSuburb } from '@/types'
import BudgetBadge from '@/components/ui/BudgetBadge.vue'
import MapLegend from './MapLegend.vue'

/* every suburb coloured by how well it fits this household, which is the one
   thing Google Maps can't do for them.

   decisions worth knowing:
   - no street tiles by default. the shapes alone answer "where", and tiles
     cost data and tell a third party the device's address. Show street map
     turns them on for people who want them
   - the select under the map is the keyboard and screen reader way in. the
     list view carries the same information, so the map is never the only route
   - this component is loaded on its own, so Leaflet is only downloaded by
     people who open the map */

const props = defineProps<{
  suburbs: RankedSuburb[]
  total: number
}>()

const selectedId = defineModel<string | null>('selected', { default: null })

const { t } = useI18n()
const container = ref<HTMLElement | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const showStreets = ref(false)

let map: L.Map | null = null
let shapes: L.GeoJSON<BoundaryProperties> | null = null
let tiles: L.TileLayer | null = null

const byId = computed(() => new Map(props.suburbs.map((item) => [item.suburb.id, item])))
const selected = computed(() => (selectedId.value ? byId.value.get(selectedId.value) : undefined))

// ranked suburbs first in rank order, then everything else by name
const pickerOptions = computed(() =>
  [...props.suburbs].sort(
    (a, b) =>
      (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
      a.suburb.name.localeCompare(b.suburb.name),
  ),
)

// colours come from tokens.css so the palette is defined once. SVG attributes
// can't read var(), hence reading the computed value
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function rampStep(match: number): number {
  if (match >= 85) return 5
  if (match >= 70) return 4
  if (match >= 55) return 3
  if (match >= 40) return 2
  return 1
}

function styleFor(id: string | undefined): L.PathOptions {
  const item = id ? byId.value.get(id) : undefined
  const isSelected = id !== undefined && id === selectedId.value
  const base: L.PathOptions = {
    color: token('--nr-map-line'),
    weight: isSelected ? 4 : 1,
    opacity: 1,
    fillOpacity: showStreets.value ? 0.7 : 1,
  }
  if (!item || item.match === null) return { ...base, fillColor: 'url(#nr-hatch)' }
  return { ...base, fillColor: token(`--nr-map-${rampStep(item.match)}`) }
}

function restyle() {
  shapes?.setStyle((feature) => styleFor(feature?.properties.id))
}

// the diagonal hatching for missing data. Leaflet has no pattern fills, so
// the pattern goes into its SVG once and paths point at it with url(#nr-hatch)
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
  stripe.setAttribute('stroke-width', '3')
  pattern.append(background, stripe)
  defs.append(pattern)
  svg.prepend(defs)
}

function layerFor(id: string): L.Polygon | undefined {
  let found: L.Polygon | undefined
  shapes?.eachLayer((layer) => {
    const feature = (layer as L.Polygon).feature as
      Feature<Geometry, BoundaryProperties> | undefined
    if (feature?.properties.id === id) found = layer as L.Polygon
  })
  return found
}

// start on the suburbs that matter: the top three, close enough for names to show
function fitToTop() {
  if (!map || !shapes) return
  const top = props.suburbs.filter((item) => item.rank !== null && item.rank <= 3)
  const bounds = L.latLngBounds([])
  for (const item of top) {
    const layer = layerFor(item.suburb.id)
    if (layer) bounds.extend(layer.getBounds())
  }
  map.fitBounds(bounds.isValid() ? bounds : shapes.getBounds(), { padding: [16, 16] })
}

function pick(id: string) {
  selectedId.value = id
  const layer = layerFor(id)
  if (map && layer) map.fitBounds(layer.getBounds(), { maxZoom: 13, padding: [24, 24] })
}

function syncLabels() {
  // names overlap when zoomed right out, so they only show from suburb level in
  container.value?.classList.toggle('suburb-map--far', (map?.getZoom() ?? 0) < 11.5)
}

onMounted(async () => {
  try {
    const data = await loadBoundaries()
    if (!container.value) return

    map = L.map(container.value, { scrollWheelZoom: false, zoomSnap: 0.5 })
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')

    shapes = L.geoJSON<BoundaryProperties>(data, {
      style: (feature) => styleFor(feature?.properties.id),
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          selectedId.value = feature.properties.id
        })
        layer.bindTooltip(feature.properties.name, {
          permanent: true,
          direction: 'center',
          className: 'suburb-map__label',
          interactive: false,
        })
      },
    }).addTo(map)

    // Leaflet holds layers back until the map has a view, so the SVG the
    // hatching goes into only exists after the first fit
    fitToTop()
    const svg = container.value.querySelector('svg')
    if (svg) addHatch(svg)

    map.on('zoomend', syncLabels)
    syncLabels()
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
watch(() => props.suburbs, restyle)

watch(showStreets, (on) => {
  if (!map) return
  if (on) {
    tiles ??= L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
  <div class="suburb-map">
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
    </div>

    <div v-if="selected" class="suburb-map__selected" aria-live="polite">
      <div class="suburb-map__selected-top">
        <span v-if="selected.rank" class="suburb-map__rank" aria-hidden="true">
          {{ selected.rank }}
        </span>
        <h2 class="suburb-map__name">{{ selected.suburb.name }}</h2>
        <BudgetBadge :status="selected.status" />
      </div>
      <p class="suburb-map__selected-line">
        <span v-if="selected.match !== null">{{ t('map.match', { score: selected.match }) }}</span>
        <span v-if="!selected.rank" class="muted">{{ t('map.notRanked') }}</span>
        <RouterLink :to="{ name: 'suburb', params: { id: selected.suburb.id } }">
          {{ t('map.details') }}
          <span class="visually-hidden">{{
            t('results.detailsFor', { suburb: selected.suburb.name })
          }}</span>
        </RouterLink>
      </p>
    </div>

    <div class="suburb-map__controls">
      <div class="suburb-map__picker">
        <label for="map-pick" class="field__label">{{ t('map.pick') }}</label>
        <select id="map-pick" :value="selectedId ?? ''" @change="onPick">
          <option v-for="item in pickerOptions" :key="item.suburb.id" :value="item.suburb.id">
            {{ item.rank ? `${item.rank}. ${item.suburb.name}` : item.suburb.name }}
            ({{ t(`status.${item.status}`) }})
          </option>
        </select>
      </div>
      <div>
        <button
          type="button"
          class="btn btn--outline suburb-map__streets"
          :aria-pressed="showStreets ? 'true' : 'false'"
          aria-describedby="map-streets-hint"
          @click="showStreets = !showStreets"
        >
          {{ t('map.streets') }}
        </button>
        <p id="map-streets-hint" class="field__hint">{{ t('map.streetsHint') }}</p>
      </div>
    </div>

    <MapLegend />
    <p class="field__hint">{{ t('map.sampleShapes') }}</p>
  </div>
</template>

<style scoped>
.suburb-map__frame {
  position: relative;
  margin-bottom: 1rem;
}

.suburb-map__canvas {
  height: clamp(20rem, 60vh, 34rem);
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

.suburb-map__selected {
  margin-bottom: 1rem;
  padding: 1rem 1.25rem;
  border: 3px solid var(--nr-wine);
  border-radius: var(--nr-radius);
  background: var(--nr-surface-raised);
}

.suburb-map__selected-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.suburb-map__rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--nr-wine);
  color: var(--nr-cream);
  font-weight: 700;
}

.suburb-map__name {
  flex: 1;
  margin: 0;
  font-size: 1.375rem;
}

.suburb-map__selected-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1rem;
  margin: 0.5rem 0 0;
  color: var(--nr-rust);
  font-weight: 700;
}

.suburb-map__selected-line a {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
}

.suburb-map__controls {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.25rem;
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

.suburb-map__streets[aria-pressed='true'] {
  background: var(--nr-wine);
  color: var(--nr-cream);
}

@media (min-width: 40rem) {
  .suburb-map__controls {
    grid-template-columns: 1fr auto;
    align-items: end;
  }
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

.suburb-map .suburb-map__label {
  padding: 0.1rem 0.4rem;
  border: 0;
  border-radius: 0.35rem;
  background: var(--nr-cream);
  box-shadow: none;
  color: var(--nr-espresso);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.suburb-map .suburb-map__label::before {
  display: none;
}

.suburb-map--far .suburb-map__label {
  display: none;
}
</style>
