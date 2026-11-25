<script setup lang="ts">
import { computed } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { Info, TramFront } from '@lucide/vue'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import type { SuburbResult } from '@/services/results'
import type { MapData } from '@/types/scoring'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import { GOOGLE_TRANSIT, JOURNEY_PLANNER } from '@/data/journeyPlanners'

/* US 4.2, public transport times from this suburb to the places they picked
   on step 4. the times are suburb to suburb, so the box says so and points
   to the two planners that do address to address once they've found a home */

const props = defineProps<{ item: SuburbResult; data: MapData }>()
const { t } = useI18n()
const facts = useSuburbFacts()

const trips = computed(() => facts.travelLines(props.item, props.data))
</script>

<template>
  <section class="travel" aria-labelledby="travel-heading">
    <h2 id="travel-heading">{{ t('travel.title') }}</h2>

    <template v-if="!trips.length">
      <p>{{ t('travel.empty') }}</p>
      <RouterLink :to="{ name: 'priorities', hash: '#places-heading' }">
        {{ t('travel.add') }}
      </RouterLink>
    </template>

    <template v-else>
      <ul class="travel__list">
        <li v-for="trip in trips" :key="trip.key">
          <TramFront class="travel__icon" :size="22" aria-hidden="true" />
          <span class="travel__place">{{ trip.place }}</span>
          <span :class="trip.kind === 'none' ? 'travel__none' : undefined">{{ trip.text }}</span>
        </li>
      </ul>
      <div class="travel__note" role="note" aria-labelledby="travel-note-title">
        <h3 id="travel-note-title" class="travel__note-title">
          <Info :size="22" aria-hidden="true" />
          {{ t('travel.noteTitle') }}
        </h3>
        <p>{{ t('travel.method', { suburb: item.name }) }}</p>
        <I18nT keypath="travel.check" tag="p" scope="global">
          <template #google>
            <ExternalLink :href="GOOGLE_TRANSIT">Google Maps</ExternalLink>
          </template>
          <template #planner>
            <ExternalLink :href="JOURNEY_PLANNER">{{ t('travel.planner') }}</ExternalLink>
          </template>
        </I18nT>
      </div>
      <p class="travel__source">{{ t('travel.source') }}</p>
    </template>
  </section>
</template>

<style scoped>
.travel {
  margin-top: 1.75rem;
}

.travel__list {
  margin: 0.75rem 0;
  padding: 0;
  list-style: none;
}

.travel__list li {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.75rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--nr-line);
}

.travel__list li:last-child {
  border-bottom: 1px solid var(--nr-line);
}

.travel__icon {
  grid-row: span 2;
  margin-top: 0.15rem;
  color: var(--nr-rust);
}

.travel__place {
  font-weight: 700;
}

.travel__none {
  color: var(--nr-ink-muted);
}

/* the same apricot box as nearby services and the rent trend */
.travel__note {
  margin: 1rem 0 0.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--nr-line);
  border-inline-start: 5px solid var(--nr-orange);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-panel);
}

.travel__note p {
  margin: 0.35rem 0 0;
}

.travel__note-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.25rem;
}

.travel__note-title svg {
  flex: none;
  color: var(--nr-rust);
}

.travel__source {
  margin: 0.25rem 0 0;
  color: var(--nr-rust);
  font-size: 0.9375rem;
}
</style>
