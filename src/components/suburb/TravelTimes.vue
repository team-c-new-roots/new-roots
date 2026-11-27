<script setup lang="ts">
import { computed } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { ChevronDown, Info } from '@lucide/vue'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import type { SuburbResult } from '@/services/results'
import type { MapData } from '@/types/scoring'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import { GOOGLE_TRANSIT, JOURNEY_PLANNER, transitTrip } from '@/data/journeyPlanners'

/* US 4.2, public transport times from this suburb to the places they picked
   on step 4. one tile a place with the minutes big, so two suburbs are easy
   to compare. each links to Google Maps, where they can set their own time,
   since our figure is only ever arriving by 8:30 am, and there's a button to
   plan any other trip from here. with no places picked, the link back to
   step 4 sits on its own line and the button goes under it, since side by
   side they wrapped badly. the method folds away underneath */

const props = defineProps<{ item: SuburbResult; data: MapData }>()
const { t } = useI18n()
const facts = useSuburbFacts()

// a walk of over an hour isn't a way to get there, the same as the card
const trips = computed(() =>
  facts.travelLines(props.item, props.data).map((trip) => {
    let kind = trip.kind
    if (kind === 'walk' && (trip.minutes === null || trip.minutes > 60)) kind = 'none'
    if (kind === 'transit' && trip.minutes === null) kind = 'none'
    return { ...trip, kind }
  }),
)
</script>

<template>
  <section class="travel" aria-labelledby="travel-heading">
    <h2 id="travel-heading">{{ t('travel.title') }}</h2>

    <template v-if="!trips.length">
      <p>{{ t('travel.empty') }}</p>
      <!-- its own line, with the trip button underneath rather than beside it -->
      <p class="travel__add">
        <RouterLink :to="{ name: 'priorities', hash: '#places-heading' }">
          {{ t('travel.add') }}
        </RouterLink>
      </p>
    </template>

    <ul v-else class="travel__list">
      <li v-for="trip in trips" :key="trip.key" class="travel__trip">
        <p class="travel__time">
          <template v-if="trip.kind === 'transit' || trip.kind === 'walk'">
            <span class="travel__minutes">{{ trip.minutes }}</span>
            <span>{{ t('travel.minutes') }}</span>
          </template>
          <span v-else class="travel__word">{{
            t(trip.kind === 'same' ? 'travel.here' : 'travel.noRoute')
          }}</span>
        </p>
        <div class="travel__about">
          <h3 class="travel__place">{{ trip.place }}</h3>
          <p class="travel__how">{{ t(`travel.how.${trip.kind}`) }}</p>
          <ExternalLink v-if="trip.kind !== 'same'" :href="transitTrip(item.name, trip.place)">
            {{ t('travel.trip') }}
            <span class="visually-hidden">{{
              t('travel.tripMore', { from: item.name, place: trip.place })
            }}</span>
          </ExternalLink>
        </div>
      </li>
    </ul>

    <!-- start filled in, they type where they're going into Google, so an
         exact address never passes through New Roots -->
    <ExternalLink class="btn btn--outline travel__plan" :href="transitTrip(item.name)">
      {{ t(trips.length ? 'travel.planFrom' : 'travel.planFirst', { suburb: item.name }) }}
    </ExternalLink>

    <details v-if="trips.length" class="how">
      <summary>
        <Info :size="20" aria-hidden="true" />
        <span>{{ t('travel.noteTitle') }}</span>
        <ChevronDown class="how__chevron" :size="20" aria-hidden="true" />
      </summary>
      <div class="how__body">
        <p>{{ t('travel.method', { suburb: item.name }) }}</p>
        <I18nT keypath="travel.check" tag="p" scope="global">
          <template #google>
            <ExternalLink :href="GOOGLE_TRANSIT">Google Maps</ExternalLink>
          </template>
          <template #planner>
            <ExternalLink :href="JOURNEY_PLANNER">{{ t('travel.planner') }}</ExternalLink>
          </template>
        </I18nT>
        <p>{{ t('travel.source') }}</p>
      </div>
    </details>
  </section>
</template>

<style scoped>
.travel__list {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

/* the minutes on the left, big, then where and how */
.travel__trip {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  border-radius: var(--nr-radius-sm);
  background: var(--nr-panel);
}

.travel__time {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  width: 4.75rem;
  margin: 0;
  line-height: 1.2;
  text-align: center;
}

.travel__minutes {
  color: var(--nr-wine-text);
  font-size: 1.75rem;
  font-weight: 700;
}

.travel__word {
  color: var(--nr-wine-text);
  font-weight: 700;
}

.travel__about {
  min-width: 0;
}

.travel__place {
  margin: 0;
  font-size: 1.0625rem;
}

.travel__how {
  margin: 0.1rem 0 0.25rem;
  color: var(--nr-ink-muted);
}

/* the link back to step 4 when no places are picked yet */
.travel__add {
  margin: 0.5rem 0 0;
}

/* always on a line of its own, under the tiles or the link */
.travel__plan {
  display: flex;
  width: fit-content;
  max-width: 100%;
  margin-top: 1rem;
}
</style>
