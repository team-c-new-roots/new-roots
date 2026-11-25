<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { SHORTLIST_MAX } from '@/stores/answers'
import { Check, CircleAlert, House, Languages, MapPin, Plus, TramFront } from '@lucide/vue'
import type { MapData } from '@/types/scoring'
import type { SuburbResult } from '@/services/results'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import BudgetBadge from '@/components/ui/BudgetBadge.vue'

/* one suburb in the results list. shows the data behind its rank right on
   the card (US 2.3, US 4.1): rent for the home size, how many neighbours
   speak the family's language, and how far the schools they need and an
   English class are. distances are chips that wrap whole, so a figure never
   splits from its unit, and every card in a row is the same height with
   View details and Show on map along the bottom. only suburbs within or
   close to budget get a number. the rest are listed after them, unnumbered.
   each card can go in or out of the summary from here too (US 2.4) */

const props = defineProps<{
  item: SuburbResult
  data: MapData
  inSummary: boolean
  // set when they tried to add this one but the summary already had three
  summaryFull?: boolean
}>()

// show on map is the same as clicking the suburb on the map: it opens there
// with its panel
const emit = defineEmits<{ showOnMap: [id: string]; toggleSummary: [id: string] }>()

const { t } = useI18n()
const facts = useSuburbFacts()

const headingId = computed(() => `suburb-${props.item.id}`)
const rent = computed(() => facts.rentLine(props.item))
const estimate = computed(() => facts.estimateLine(props.item))
const language = computed(() => facts.languageLine(props.item, props.data))
const distances = computed(() => facts.distanceFacts(props.item))
const travel = computed(() => facts.travelLines(props.item, props.data))
</script>

<template>
  <article class="suburb-card" :aria-labelledby="headingId">
    <div class="suburb-card__top">
      <span v-if="item.rank !== null" class="suburb-card__rank" aria-hidden="true">
        {{ item.rank }}
      </span>
      <h3 :id="headingId" class="suburb-card__name">{{ item.name }}</h3>
      <BudgetBadge :status="item.status" class="suburb-card__badge" />
    </div>

    <p v-if="item.match !== null" class="suburb-card__match">
      {{ t('results.match', { score: item.match }) }}
    </p>

    <ul class="suburb-card__facts">
      <li v-if="rent">
        <House :size="18" aria-hidden="true" />
        <span>
          {{ rent }}
          <small v-if="estimate" class="suburb-card__estimate">{{ estimate }}</small>
        </span>
      </li>
      <li v-if="language">
        <Languages :size="18" aria-hidden="true" />
        <span>{{ language }}</span>
      </li>
      <li v-for="trip in travel" :key="trip.key">
        <TramFront :size="18" aria-hidden="true" />
        <span>{{ trip.text }}</span>
      </li>
    </ul>

    <ul v-if="distances.length" class="suburb-card__distances">
      <li v-for="fact in distances" :key="fact.key">
        <component :is="fact.icon" :size="16" aria-hidden="true" />
        {{ fact.text }}
      </li>
    </ul>

    <div class="suburb-card__bottom">
      <div class="suburb-card__actions">
        <RouterLink :to="{ name: 'suburb', params: { id: item.id } }">
          {{ t('results.details') }}
          <span class="visually-hidden">{{ t('results.detailsFor', { suburb: item.name }) }}</span>
        </RouterLink>
        <button type="button" class="suburb-card__map" @click="emit('showOnMap', item.id)">
          <MapPin :size="18" aria-hidden="true" />
          {{ t('results.showOnMap') }}
          <span class="visually-hidden">{{ t('results.detailsFor', { suburb: item.name }) }}</span>
        </button>
      </div>
      <div class="suburb-card__summary">
        <template v-if="inSummary">
          <span class="suburb-card__saved">
            <Check :size="16" :stroke-width="3" aria-hidden="true" />
            {{ t('results.inSummary') }}
          </span>
          <button type="button" class="suburb-card__toggle" @click="emit('toggleSummary', item.id)">
            {{ t('results.removeFromSummary') }}
            <span class="visually-hidden">{{
              t('results.fromSummary', { suburb: item.name })
            }}</span>
          </button>
        </template>
        <button
          v-else
          type="button"
          class="suburb-card__toggle"
          @click="emit('toggleSummary', item.id)"
        >
          <Plus :size="18" aria-hidden="true" />
          {{ t('results.addToSummary') }}
          <span class="visually-hidden">{{ t('results.detailsFor', { suburb: item.name }) }}</span>
        </button>
      </div>
    </div>
    <p v-if="summaryFull" class="field__error suburb-card__full">
      <CircleAlert :size="18" aria-hidden="true" />
      {{ t('suburb.full', { max: SHORTLIST_MAX }) }}
    </p>
  </article>
</template>

<style scoped>
.suburb-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.1rem 1.25rem;
  border-radius: var(--nr-radius);
  background: var(--nr-panel);
}

.suburb-card__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}

.suburb-card__rank {
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

.suburb-card__name {
  flex: 1;
  margin: 0;
  font-size: 1.375rem;
}

.suburb-card__match {
  margin: 0 0 0.35rem;
  color: var(--nr-rust);
  font-weight: 700;
}

.suburb-card__facts {
  margin: 0 0 0.6rem;
  padding: 0;
  list-style: none;
}

.suburb-card__facts li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding-block: 0.15rem;
}

.suburb-card__facts svg {
  flex: none;
  margin-top: 0.2rem;
  color: var(--nr-rust);
}

.suburb-card__estimate {
  display: block;
  color: var(--nr-ink-muted);
  font-size: 0.875rem;
}

/* each distance is one chip, so "0.8 km" can never land on a line of its own */
.suburb-card__distances {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 0.75rem;
  padding: 0;
  list-style: none;
}

.suburb-card__distances li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.65rem;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-surface-raised);
  font-size: 0.9375rem;
  white-space: nowrap;
}

.suburb-card__distances svg {
  color: var(--nr-rust);
}

.suburb-card__bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
}

.suburb-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1.25rem;
}

.suburb-card__bottom a {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
}

/* a button that looks like the link beside it */
.suburb-card__map {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: var(--nr-target);
  padding: 0;
  border: 0;
  background: none;
  color: var(--nr-rust);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15em;
  cursor: pointer;
}

.suburb-card__map:hover {
  color: var(--nr-wine-text);
}

.suburb-card__summary {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 0.75rem;
}

.suburb-card__saved {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--nr-wine-text);
  font-weight: 700;
}

/* looks like the links beside it, in the summary's wine */
.suburb-card__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: var(--nr-target);
  padding: 0;
  border: 0;
  background: none;
  color: var(--nr-wine-text);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15em;
  cursor: pointer;
}

.suburb-card__toggle:hover {
  color: var(--nr-rust);
}

/* the error style from the form fields, so it reads as a problem in
   every theme, with an icon as well as the colour */
.suburb-card__full {
  margin: 0.4rem 0 0;
}
</style>
