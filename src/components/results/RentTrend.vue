<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { ChevronDown, Lightbulb, Table2 } from '@lucide/vue'
import { useFormat } from '@/composables/useFormat'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import {
  comparedWithMelbourne,
  loadRentTrend,
  rentTrendFor,
  sharesArea,
  yearlyChange,
  type RentTrend,
} from '@/services/rentTrend'

/* US 1.4, five years of median rent for this household's home beside
   Melbourne's. the area's line is solid and Melbourne's dashed, and both are
   named in the legend and at the line ends, so colour never carries it alone.
   the table underneath has the same figures for anyone not using the chart */

const props = defineProps<{
  suburbId: string
  suburbName: string
  rentMetric: string
  // the home label, like 2-bed flat
  home: string
}>()

const { t } = useI18n()
const { money, percent, monthYear, year } = useFormat()

const status = ref<'loading' | 'ready' | 'error'>('loading')
const trend = ref<RentTrend | null>(null)

async function load() {
  status.value = 'loading'
  try {
    const file = await loadRentTrend()
    trend.value = rentTrendFor(file, props.suburbId, props.rentMetric)
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

watch(() => [props.suburbId, props.rentMetric], load, { immediate: true })

const shared = computed(() =>
  trend.value ? sharesArea(trend.value.area, props.suburbName) : false,
)
// what the sentences call it, the suburb or the area it's counted in
const place = computed(() =>
  trend.value && shared.value ? t('rentTrend.place', { area: trend.value.area }) : props.suburbName,
)
// the legend's short name
const lineName = computed(() => (shared.value ? trend.value!.area : props.suburbName))

const signed = (value: number) => percent(Math.round(Math.abs(value)))

const lead = computed(() => {
  const line = trend.value
  if (!line) return ''
  const key = `${line.change < 0 ? 'down' : 'up'}${line.ownHome ? '' : 'All'}`
  return t(`rentTrend.${key}`, {
    home: props.home,
    place: place.value,
    change: signed(line.change),
    from: monthYear(line.periods[0]!),
    to: monthYear(line.periods[line.periods.length - 1]!),
  })
})

const versus = computed(() => {
  const line = trend.value
  if (!line) return ''
  // faster or slower than Melbourne is said once, in the box below
  return t(line.melbourneChange < 0 ? 'rentTrend.melbourneDown' : 'rentTrend.melbourneUp', {
    change: signed(line.melbourneChange),
  })
})

// what it means for a renter, in dollars rather than a percent, and what
// protects them when rent goes up. only says what has happened, never what
// rents will do next
const CAV_RENT_INCREASES =
  'https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/rent/rent-increases'

const yearly = computed(() => {
  const line = trend.value
  if (!line) return ''
  const dollars = yearlyChange(line)
  if (dollars === 0) return t('rentTrend.means.flat')
  return t(dollars > 0 ? 'rentTrend.means.yearlyUp' : 'rentTrend.means.yearlyDown', {
    amount: money(Math.abs(dollars)),
  })
})

// the chart is drawn at the width it's shown, so text never stretches
const frame = ref<HTMLElement | null>(null)
const width = ref(600)
let watcher: ResizeObserver | null = null

function observe(element: HTMLElement | null) {
  watcher?.disconnect()
  if (!element || typeof ResizeObserver === 'undefined') return
  watcher = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(260, Math.round(entry.contentRect.width))
  })
  watcher.observe(element)
}
watch(frame, observe)
onMounted(() => observe(frame.value))
onBeforeUnmount(() => watcher?.disconnect())

const HEIGHT = 230
const PAD = { top: 16, right: 64, bottom: 30 }

const chart = computed(() => {
  const line = trend.value
  if (!line) return null
  const values = [...line.rents, ...line.melbourne].filter((v): v is number => v !== null)
  const low = Math.min(...values)
  const high = Math.max(...values)
  // clean steps, about four of them
  const step = [25, 50, 100, 200, 250, 500].find((size) => (high - low) / size <= 4) ?? 1000
  const bottom = Math.floor(low / step) * step
  const top = Math.ceil(high / step) * step
  const ticks: number[] = []
  for (let tick = bottom; tick <= top; tick += step) ticks.push(tick)

  // room for the widest rent label, which some languages write longer. about
  // 8px a character at the 14px the axis is set in
  const left = Math.max(...ticks.map((tick) => money(tick).length)) * 8.2 + 14
  const plotWidth = width.value - left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const last = line.periods.length - 1
  const x = (i: number) => left + (i / last) * plotWidth
  const y = (value: number) => PAD.top + (1 - (value - bottom) / (top - bottom || 1)) * plotHeight

  // a quarter with too few leases has no figure, so the line breaks there
  const path = (series: (number | null)[]) => {
    let d = ''
    let pen = false
    series.forEach((value, i) => {
      if (value === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`
      pen = true
    })
    return d
  }

  // a quarter with a figure but none either side has no line to draw, so it
  // gets a dot instead of vanishing (Jake's testing, US 1.4 test 3)
  const lone = (series: (number | null)[]) =>
    series.flatMap((value, i) =>
      value !== null && series[i - 1] == null && series[i + 1] == null
        ? [{ i, x: x(i), y: y(value) }]
        : [],
    )

  // the change goes at each line's end. if the ends sit close, the labels
  // move apart and a short leader joins each to its line
  const endArea = y(line.rents[last]!)
  const endCity = y(line.melbourne[last]!)
  let labelArea = endArea
  let labelCity = endCity
  const gap = 18
  if (Math.abs(endArea - endCity) < gap) {
    const middle = (endArea + endCity) / 2
    const areaAbove = endArea <= endCity
    labelArea = middle + (areaAbove ? -gap / 2 : gap / 2)
    labelCity = middle + (areaAbove ? gap / 2 : -gap / 2)
  }

  // June each year, the same quarter as the latest figures. on a narrow
  // screen every other year, counting back from the latest
  const junes = line.periods.flatMap((period, i) => (period.slice(5, 7) === '06' ? [i] : []))
  const roomy = plotWidth / Math.max(1, junes.length - 1) >= 44
  const years = junes.filter((_, n) => roomy || (junes.length - 1 - n) % 2 === 0)

  return {
    ticks: ticks.map((value) => ({ value, y: y(value) })),
    years: years.map((i) => ({ i, x: x(i), label: year(line.periods[i]!) })),
    area: path(line.rents),
    city: path(line.melbourne),
    loneArea: lone(line.rents),
    loneCity: lone(line.melbourne),
    endX: x(last),
    endArea,
    endCity,
    labelArea,
    labelCity,
    left,
    right: width.value - PAD.right,
    plotTop: PAD.top,
    plotBottom: HEIGHT - PAD.bottom,
    x,
    y,
    last,
  }
})

// the quarter the legend reads out, the latest until someone points at one
const picked = ref<number | null>(null)
const shown = computed(() => picked.value ?? (trend.value ? trend.value.periods.length - 1 : 0))

function point(event: PointerEvent) {
  const box = chart.value
  const svg = event.currentTarget as SVGSVGElement
  if (!box) return
  const rect = svg.getBoundingClientRect()
  const along = (event.clientX - rect.left) * (width.value / rect.width)
  const fraction = (along - box.left) / (box.right - box.left)
  picked.value = Math.min(box.last, Math.max(0, Math.round(fraction * box.last)))
}

const rentAt = (series: (number | null)[], i: number) => {
  const value = series[i]
  return value === null || value === undefined ? t('rentTrend.noFigure') : money(value)
}

const juneRows = computed(() => {
  const line = trend.value
  if (!line) return []
  return line.periods.flatMap((period, i) =>
    period.slice(5, 7) === '06'
      ? [
          {
            period,
            year: year(period),
            area: rentAt(line.rents, i),
            city: rentAt(line.melbourne, i),
          },
        ]
      : [],
  )
})

const sign = (value: number) => (value < 0 ? '−' : '+')
</script>

<template>
  <section class="rent-trend" aria-labelledby="rent-trend-heading">
    <h2 id="rent-trend-heading">{{ t('rentTrend.title') }}</h2>

    <p v-if="status === 'loading'" class="muted">{{ t('rentTrend.loading') }}</p>

    <template v-else-if="status === 'error'">
      <p>{{ t('rentTrend.error') }}</p>
      <button type="button" class="btn btn--outline" @click="load">
        {{ t('rentTrend.retry') }}
      </button>
    </template>

    <p v-else-if="!trend">{{ t('rentTrend.none', { suburb: suburbName }) }}</p>

    <template v-else-if="chart">
      <p class="rent-trend__lead">{{ lead }} {{ versus }}</p>
      <p v-if="!trend.ownHome" class="rent-trend__note">
        {{ t('rentTrend.allHomes', { home }) }}
      </p>
      <p v-if="shared" class="rent-trend__note">
        {{ t('rentTrend.shared', { suburb: suburbName, area: trend.area }) }}
      </p>

      <div class="rent-trend__legend">
        <p class="rent-trend__quarter">{{ monthYear(trend.periods[shown]!) }}</p>
        <ul>
          <li>
            <svg class="rent-trend__key" width="28" height="10" aria-hidden="true">
              <line class="rent-trend__area" x1="1" y1="5" x2="27" y2="5" />
            </svg>
            <span
              >{{ lineName }} <strong>{{ rentAt(trend.rents, shown) }}</strong></span
            >
          </li>
          <li>
            <svg class="rent-trend__key" width="28" height="10" aria-hidden="true">
              <line class="rent-trend__city" x1="1" y1="5" x2="27" y2="5" />
            </svg>
            <span
              >{{ t('rentTrend.melbourne') }}
              <strong>{{ rentAt(trend.melbourne, shown) }}</strong></span
            >
          </li>
        </ul>
      </div>

      <div ref="frame" class="rent-trend__frame">
        <svg
          class="rent-trend__chart"
          :viewBox="`0 0 ${width} ${HEIGHT}`"
          :width="width"
          :height="HEIGHT"
          aria-hidden="true"
          @pointermove="point"
          @pointerdown="point"
          @pointerleave="picked = null"
        >
          <g class="rent-trend__grid">
            <line
              v-for="tick in chart.ticks"
              :key="tick.value"
              :x1="chart.left"
              :x2="chart.right"
              :y1="tick.y"
              :y2="tick.y"
            />
          </g>
          <g class="rent-trend__axis">
            <text
              v-for="tick in chart.ticks"
              :key="tick.value"
              :x="chart.left - 8"
              :y="tick.y"
              text-anchor="end"
              dominant-baseline="middle"
            >
              {{ money(tick.value) }}
            </text>
            <text
              v-for="tick in chart.years"
              :key="tick.i"
              :x="tick.x"
              :y="chart.plotBottom + 20"
              text-anchor="middle"
            >
              {{ tick.label }}
            </text>
          </g>

          <path class="rent-trend__city" :d="chart.city" />
          <path class="rent-trend__area" :d="chart.area" />
          <circle
            v-for="spot in chart.loneCity"
            :key="`city-${spot.i}`"
            class="rent-trend__lone rent-trend__lone--city"
            :cx="spot.x"
            :cy="spot.y"
            r="3.5"
          />
          <circle
            v-for="spot in chart.loneArea"
            :key="`area-${spot.i}`"
            class="rent-trend__lone"
            :cx="spot.x"
            :cy="spot.y"
            r="3.5"
          />

          <g class="rent-trend__ends">
            <line
              v-if="chart.labelArea !== chart.endArea"
              class="rent-trend__leader"
              :x1="chart.endX + 5"
              :y1="chart.endArea"
              :x2="chart.endX + 10"
              :y2="chart.labelArea"
            />
            <line
              v-if="chart.labelCity !== chart.endCity"
              class="rent-trend__leader"
              :x1="chart.endX + 5"
              :y1="chart.endCity"
              :x2="chart.endX + 10"
              :y2="chart.labelCity"
            />
            <text :x="chart.endX + 12" :y="chart.labelArea" dominant-baseline="middle">
              {{ sign(trend.change) }}{{ signed(trend.change) }}
            </text>
            <text
              class="rent-trend__end-city"
              :x="chart.endX + 12"
              :y="chart.labelCity"
              dominant-baseline="middle"
            >
              {{ sign(trend.melbourneChange) }}{{ signed(trend.melbourneChange) }}
            </text>
          </g>

          <g v-if="picked !== null" class="rent-trend__cross">
            <line
              :x1="chart.x(picked)"
              :x2="chart.x(picked)"
              :y1="chart.plotTop"
              :y2="chart.plotBottom"
            />
            <circle
              v-if="trend.melbourne[picked] != null"
              class="rent-trend__dot rent-trend__dot--city"
              :cx="chart.x(picked)"
              :cy="chart.y(trend.melbourne[picked]!)"
              r="5"
            />
            <circle
              v-if="trend.rents[picked] != null"
              class="rent-trend__dot"
              :cx="chart.x(picked)"
              :cy="chart.y(trend.rents[picked]!)"
              r="5"
            />
          </g>
        </svg>
      </div>

      <div class="rent-trend__means" role="group" aria-labelledby="rent-trend-means">
        <h3 id="rent-trend-means" class="rent-trend__means-title">
          <Lightbulb :size="22" aria-hidden="true" />
          {{ t('rentTrend.means.title') }}
        </h3>
        <p>{{ yearly }}</p>
        <p>{{ t(`rentTrend.means.${comparedWithMelbourne(trend)}`) }}</p>
        <I18nT keypath="rentTrend.means.rights" tag="p" scope="global">
          <template #cav>
            <ExternalLink :href="CAV_RENT_INCREASES">Consumer Affairs Victoria</ExternalLink>
          </template>
        </I18nT>
      </div>

      <details class="rent-trend__table">
        <summary>
          <Table2 :size="20" aria-hidden="true" />
          <span>{{ t('rentTrend.table') }}</span>
          <ChevronDown class="rent-trend__chevron" :size="20" aria-hidden="true" />
        </summary>
        <table>
          <caption>
            {{
              t('rentTrend.caption', { place })
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ t('rentTrend.year') }}</th>
              <th scope="col">{{ lineName }}</th>
              <th scope="col">{{ t('rentTrend.melbourne') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in juneRows" :key="row.period">
              <th scope="row">{{ row.year }}</th>
              <td>{{ row.area }}</td>
              <td>{{ row.city }}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <p class="rent-trend__source">
        {{ t('rentTrend.source', { date: monthYear(trend.periods[trend.periods.length - 1]!) }) }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.rent-trend__lead {
  font-size: 1.0625rem;
}

.rent-trend__note {
  color: var(--nr-ink-muted);
}

.rent-trend__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 1.5rem;
  margin-top: 1rem;
}

.rent-trend__quarter {
  margin: 0;
  font-weight: 700;
}

.rent-trend__legend ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rent-trend__legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.rent-trend__key {
  flex: none;
}

.rent-trend__frame {
  margin-top: 0.5rem;
}

/* time runs left to right in every language, like the rental report's own
   charts, so labels keep their left to right anchors in Arabic too */
.rent-trend__chart {
  direction: ltr;
  display: block;
  width: 100%;
  height: auto;
  touch-action: pan-y;
  overflow: visible;
}

.rent-trend__grid line {
  stroke: var(--nr-line);
  stroke-width: 1;
}

/* 14px, the smallest text outside the map (US 5.1 test 7). the chart is
   drawn at the width it's shown, so this is the size on screen too */
.rent-trend__axis text,
.rent-trend__ends text {
  fill: var(--nr-ink-muted);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.rent-trend__ends text {
  fill: var(--nr-ink);
  font-size: 14px;
  font-weight: 700;
}

.rent-trend__ends .rent-trend__end-city {
  font-weight: 400;
}

path.rent-trend__area,
path.rent-trend__city,
line.rent-trend__area,
line.rent-trend__city {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rent-trend__area {
  stroke: var(--nr-trend-area);
}

.rent-trend__city {
  stroke: var(--nr-trend-city);
  stroke-dasharray: 6 5;
}

.rent-trend__leader {
  stroke: var(--nr-ink-muted);
  stroke-width: 1;
}

.rent-trend__cross line {
  stroke: var(--nr-ink-muted);
  stroke-width: 1;
}

.rent-trend__dot {
  fill: var(--nr-trend-area);
  stroke: var(--nr-surface);
  stroke-width: 2;
}

.rent-trend__dot--city {
  fill: var(--nr-trend-city);
}

/* a quarter on its own between gaps, the line's colour with no outline so
   it reads as part of the line rather than the hover dot */
.rent-trend__lone {
  fill: var(--nr-trend-area);
}

.rent-trend__lone--city {
  fill: var(--nr-trend-city);
}

/* boxed like the move-in cost, since it's the part to act on */
.rent-trend__means {
  margin: 1rem 0 0.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--nr-line);
  border-inline-start: 5px solid var(--nr-orange);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-panel);
}

.rent-trend__means p {
  margin: 0.35rem 0 0;
}

.rent-trend__means-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.25rem;
}

.rent-trend__means-title svg {
  flex: none;
  color: var(--nr-rust);
}

.rent-trend__table {
  margin-top: 0.5rem;
}

.rent-trend__table summary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--nr-target);
  color: var(--nr-wine-text);
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}

.rent-trend__table summary::-webkit-details-marker {
  display: none;
}

.rent-trend__table summary span {
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.rent-trend__table summary svg {
  flex: none;
  color: var(--nr-rust);
}

.rent-trend__chevron {
  transition: transform 0.15s ease;
}

.rent-trend__table[open] .rent-trend__chevron {
  transform: rotate(180deg);
}

.rent-trend__table table {
  width: 100%;
  margin-top: 0.25rem;
  border-collapse: collapse;
}

.rent-trend__table td {
  font-variant-numeric: tabular-nums;
}

.rent-trend__table caption {
  padding-bottom: 0.25rem;
  color: var(--nr-ink-muted);
  text-align: start;
}

.rent-trend__table th,
.rent-trend__table td {
  padding: 0.4rem 0.5rem 0.4rem 0;
  border-top: 1px solid var(--nr-line);
  text-align: start;
}

.rent-trend__table thead th {
  border-top: 0;
}

.rent-trend__table tbody th {
  font-weight: 400;
}

.rent-trend__source {
  margin-top: 0.5rem;
  color: var(--nr-rust);
  font-size: 0.9375rem;
}

@media (prefers-reduced-motion: reduce) {
  .rent-trend__chevron {
    transition: none;
  }
}
</style>
