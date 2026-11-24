<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, Landmark, Pill, Stethoscope } from '@lucide/vue'
import { useFormat } from '@/composables/useFormat'
import { metricValue } from '@/services/results'
import { WALK_LIMIT_MINUTES, walkingMinutes } from '@/services/walking'
import type { ObtRow } from '@/types/scoring'

/* US 4.3, how far the three services someone new uses most are. a walk of up
   to 20 minutes shows the time with the distance after it, anything further
   just the distance. a service with no figures anywhere yet, like Services
   Australia centres until they're in Gold, is left off rather than shown
   empty. one that's missing for this suburb only says so */

const props = defineProps<{ obt: ObtRow | null; suburb: string; all: ObtRow[] }>()
const { t } = useI18n()
const { distance } = useFormat()

const SERVICES: { key: string; metric: string; icon: Component; source: string }[] = [
  { key: 'pharmacy', metric: 'pharmacy_proximity', icon: Pill, source: 'healthSource' },
  { key: 'gp', metric: 'gp_proximity', icon: Stethoscope, source: 'healthSource' },
  {
    key: 'servicesAustralia',
    metric: 'services_australia_proximity',
    icon: Landmark,
    source: 'centrelinkSource',
  },
]

const shown = computed(() =>
  SERVICES.filter((service) => props.all.some((row) => metricValue(row, service.metric) !== null)),
)

const rows = computed(() =>
  shown.value.map((service) => {
    const km = metricValue(props.obt, service.metric)
    const name = t(`nearbyServices.types.${service.key}`)
    let text: string
    if (km === null) text = t('nearbyServices.missing', { suburb: props.suburb })
    else {
      const minutes = walkingMinutes(km)
      const far = distance(km)
      if (minutes > WALK_LIMIT_MINUTES) text = t('nearbyServices.away', { distance: far })
      else if (minutes === 0) text = t('nearbyServices.underFive', { distance: far })
      else text = t('nearbyServices.walk', { minutes, distance: far })
    }
    return { ...service, name, text, missing: km === null }
  }),
)

const sources = computed(() => [...new Set(shown.value.map((service) => service.source))])
</script>

<template>
  <section v-if="rows.length" class="nearby" aria-labelledby="nearby-heading">
    <h2 id="nearby-heading">{{ t('nearbyServices.title') }}</h2>
    <ul class="nearby__list">
      <li v-for="row in rows" :key="row.key">
        <component :is="row.icon" class="nearby__icon" :size="22" aria-hidden="true" />
        <span class="nearby__name">{{ row.name }}</span>
        <span :class="row.missing ? 'nearby__missing' : 'nearby__time'">{{ row.text }}</span>
      </li>
    </ul>
    <div class="nearby__note" role="note" aria-labelledby="nearby-note-title">
      <h3 id="nearby-note-title" class="nearby__note-title">
        <Info :size="22" aria-hidden="true" />
        {{ t('nearbyServices.noteTitle') }}
      </h3>
      <p>{{ t('nearbyServices.method', { limit: WALK_LIMIT_MINUTES }) }}</p>
      <p>{{ t('nearbyServices.limits') }}</p>
    </div>
    <p v-for="source in sources" :key="source" class="nearby__source">
      {{ t(`nearbyServices.${source}`) }}
    </p>
  </section>
</template>

<style scoped>
.nearby {
  margin-top: 1.75rem;
}

.nearby__list {
  margin: 0.75rem 0;
  padding: 0;
  list-style: none;
}

.nearby__list li {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.75rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--nr-line);
}

.nearby__list li:last-child {
  border-bottom: 1px solid var(--nr-line);
}

.nearby__icon {
  grid-row: span 2;
  margin-top: 0.15rem;
  color: var(--nr-rust);
}

.nearby__name {
  font-weight: 700;
}

.nearby__missing {
  color: var(--nr-ink-muted);
}

/* the same apricot box as the move-in cost and the rent trend */
.nearby__note {
  margin: 1rem 0 0.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--nr-line);
  border-inline-start: 5px solid var(--nr-orange);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-panel);
}

.nearby__note p {
  margin: 0.35rem 0 0;
}

.nearby__note-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.25rem;
}

.nearby__note-title svg {
  flex: none;
  color: var(--nr-rust);
}

.nearby__source {
  margin: 0.25rem 0 0;
  color: var(--nr-rust);
  font-size: 0.9375rem;
}
</style>
