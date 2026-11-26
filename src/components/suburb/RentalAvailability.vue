<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, CircleAlert, Info, KeyRound } from '@lucide/vue'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import { useFormat } from '@/composables/useFormat'
import { useResultsStore } from '@/stores/results'
import { affordableFor, areaSuburbs } from '@/services/availability'
import type { SuburbResult } from '@/services/results'

/* US 2.5, how often homes like theirs come up for rent here. the answer
   first, in words and on a three step scale, then two figures to compare,
   then the method folded away. a suburb the rental report doesn't count on
   its own gets a share of its report area's or council's figure, split
   evenly across the suburbs it covers, and the figure says so. the scale
   uses the same split, so a council total isn't compared with one suburb */

const props = defineProps<{ item: SuburbResult }>()
const { t } = useI18n()
const facts = useSuburbFacts()
const results = useResultsStore()
const { whole, percent } = useFormat()

const BANDS = ['fewer', 'about', 'more'] as const

const found = computed(() => facts.availabilityOf(props.item))
const homes = computed(() => {
  const label = facts.homeFor(props.item)
  return t(`homesMany.${label.type}`, { beds: label.bedrooms })
})
const period = computed(() => results.availability?.period ?? '')

const area = computed(() => {
  const item = found.value
  if (!item || item.level === 's') return null
  return item.level === 'p' ? facts.list(areaSuburbs(item.area ?? '')) : item.area
})

const figure = computed(() => {
  const item = found.value
  if (!item) return null
  if (item.level === 's') {
    return { value: whole(item.count), label: t('availability.countHere', { homes: homes.value }) }
  }
  return {
    value: t('availability.about', { n: whole(Math.max(1, Math.round(item.count / item.shared))) }),
    label: t(item.level === 'p' ? 'availability.countArea' : 'availability.countCouncil', {
      homes: homes.value,
      area: area.value,
    }),
  }
})

const method = computed(() => {
  const item = found.value
  if (!item) return null
  const values = {
    homes: homes.value,
    count: whole(item.count),
    period: period.value,
    shared: item.shared,
    suburb: props.item.name,
    area: area.value,
  }
  if (item.level === 's') return t('availability.methodHere', values)
  return t(item.level === 'p' ? 'availability.methodArea' : 'availability.methodCouncil', values)
})

const bedrooms = computed(() => facts.homeFor(props.item).bedrooms)
const affordable = computed(() => {
  const file = results.availability
  if (!file) return null
  const row = affordableFor(file, props.item.id, bedrooms.value)
  if (!row) return null
  const beds =
    bedrooms.value >= 4
      ? t('availability.bedsFour')
      : t('availability.beds', { beds: bedrooms.value })
  return { ...row, beds, share: percent(row.share), count: whole(row.count) }
})
</script>

<template>
  <section v-if="results.availability" class="availability" aria-labelledby="availability-heading">
    <h2 id="availability-heading">{{ t('availability.title') }}</h2>

    <template v-if="found">
      <!-- the same tag as the results card -->
      <p v-if="found.few" class="availability__flag">
        <span class="badge badge--few">
          <CircleAlert :size="18" :stroke-width="2.5" aria-hidden="true" />
          {{ t('availability.few') }}
        </span>
      </p>
      <p class="availability__answer">
        <KeyRound :size="24" aria-hidden="true" />
        {{ t(`availability.verdict.${found.band}`, { homes }) }}
      </p>

      <!-- the words above say the same, so the scale is for eyes only -->
      <div class="availability__scale" aria-hidden="true">
        <span
          v-for="band in BANDS"
          :key="band"
          class="availability__step"
          :class="[`availability__step--${band}`, { 'is-here': band === found.band }]"
        />
      </div>
      <div class="availability__scale-labels" aria-hidden="true">
        <span v-for="band in BANDS" :key="band">{{ t(`availability.scale.${band}`) }}</span>
      </div>
    </template>
    <p v-else class="availability__answer">
      <KeyRound :size="24" aria-hidden="true" />
      {{ t('availability.missing', { homes }) }}
    </p>

    <div class="figure-tiles">
      <p v-if="figure" class="figure-tile">
        <span class="figure-tile__value">{{ figure.value }}</span>
        <span class="figure-tile__label">{{ figure.label }}</span>
      </p>
      <p v-if="affordable" class="figure-tile">
        <span class="figure-tile__value">{{ affordable.share }}</span>
        <span class="figure-tile__label">{{
          t('availability.affordableTile', { beds: affordable.beds, council: affordable.council })
        }}</span>
      </p>
    </div>

    <p class="availability__past">{{ t('availability.past') }}</p>

    <details class="how">
      <summary>
        <Info :size="20" aria-hidden="true" />
        <span>{{ t('availability.how') }}</span>
        <ChevronDown class="how__chevron" :size="20" aria-hidden="true" />
      </summary>
      <div class="how__body">
        <p v-if="method">{{ method }}</p>
        <p v-if="found">{{ t('availability.compare') }}</p>
        <p>{{ t('availability.chances') }}</p>
        <p v-if="affordable">
          {{
            t('availability.affordableHow', {
              council: affordable.council,
              beds: affordable.beds,
              count: affordable.count,
            })
          }}
        </p>
        <p>{{ t('availability.affordableSource', { period }) }}</p>
      </div>
    </details>
    <p class="availability__source">{{ t('availability.source', { period }) }}</p>
  </section>
</template>

<style scoped>
.availability__answer {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 0.5rem 0 0;
}

.availability__answer {
  font-size: 1.125rem;
  font-weight: 700;
}

.availability__answer svg {
  flex: none;
  margin-top: 0.05rem;
  color: var(--nr-rust);
}

.availability__flag {
  margin: 0.75rem 0 0;
}

.availability__flag .badge {
  font-size: 1rem;
}

.availability__scale {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin: 1rem 0 0.5rem;
  /* room for the outline on the end steps */
  padding: 0 6px;
}

.availability__step {
  height: 0.75rem;
  border: 1px solid var(--nr-scale-edge);
  border-radius: 0.375rem;
}

/* the map's own ramp, lighter for fewer. white, yellow and blue in high
   contrast, with a black edge so the white step still shows */
.availability__step--fewer {
  background: var(--nr-scale-fewer);
}

.availability__step--about {
  background: var(--nr-scale-about);
}

.availability__step--more {
  background: var(--nr-scale-more);
}

/* where this suburb sits, marked by an outline as well as the words, not
   colour alone */
.availability__step.is-here {
  outline: 3px solid var(--nr-ink);
  outline-offset: 3px;
}

.availability__scale-labels {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0 6px;
  color: var(--nr-ink-muted);
  font-size: 0.875rem;
}

.availability__scale-labels span:nth-child(2) {
  text-align: center;
}

.availability__scale-labels span:last-child {
  text-align: end;
}

.availability__past {
  margin: 0.75rem 0 0;
  color: var(--nr-ink-muted);
}

.availability__source {
  margin: 0.25rem 0 0;
  color: var(--nr-rust);
  font-size: 0.9375rem;
}
</style>
