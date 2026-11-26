<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from '@lucide/vue'
import { useFormat } from '@/composables/useFormat'
import { PLACE_MARGIN_KM } from '@/data/places'
import { loadBoundaries } from '@/services/boundaries'
import { distanceKm, loadPlaces, type Place } from '@/services/places'

/* US 3.2, the libraries and community centres in a suburb or a 20 minute
   walk past its border, from the same files as the map's places. the count
   opens a list of each one's name and how far it is from the middle */

const props = defineProps<{ suburbId: string; suburb: string }>()
const { t } = useI18n()
const { km } = useFormat()

const TYPES = new Set(['library', 'communityCentre'])

const status = ref<'loading' | 'ready' | 'error'>('loading')
const nearby = ref<{ place: Place; km: number }[]>([])

async function load() {
  status.value = 'loading'
  try {
    const [places, boundaries] = await Promise.all([loadPlaces(props.suburbId), loadBoundaries()])
    const shape = boundaries.features.find(
      (feature) => feature.properties.suburb_id === props.suburbId,
    )
    const centre = shape
      ? { lat: shape.properties.label_lat, lon: shape.properties.label_lon }
      : null
    nearby.value = places
      .filter((place) => TYPES.has(place.type))
      .map((place) => ({ place, km: centre ? distanceKm(centre, place) : 0 }))
      .sort((a, b) => a.km - b.km)
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

watch(() => props.suburbId, load, { immediate: true })

const margin = computed(() => km(PLACE_MARGIN_KM))
const count = computed(() =>
  t(
    'communityPlaces.count',
    { n: nearby.value.length, suburb: props.suburb, km: margin.value },
    nearby.value.length,
  ),
)
</script>

<template>
  <section class="community" aria-labelledby="community-heading">
    <h2 id="community-heading">{{ t('communityPlaces.title') }}</h2>

    <p v-if="status === 'loading'" class="muted">{{ t('communityPlaces.loading') }}</p>
    <template v-else-if="status === 'error'">
      <p>{{ t('communityPlaces.error') }}</p>
      <button type="button" class="btn btn--outline" @click="load">
        {{ t('communityPlaces.retry') }}
      </button>
    </template>
    <p v-else-if="!nearby.length">
      {{ t('communityPlaces.none', { suburb, km: margin }) }}
    </p>
    <details v-else class="community__list">
      <summary>
        <span class="community__count">{{ count }}</span>
        <span class="community__open">
          {{ t('communityPlaces.open') }}
          <ChevronDown class="community__chevron" :size="20" aria-hidden="true" />
        </span>
      </summary>
      <ul>
        <li
          v-for="{ place, km: distance } in nearby"
          :key="`${place.type}${place.lat}${place.lon}`"
        >
          <strong>{{ place.name ?? t(`places.types.${place.type}`) }}</strong>
          <span class="community__about">
            {{ t(`places.types.${place.type}`) }},
            {{ t('places.distance', { km: km(distance), suburb }) }}
          </span>
        </li>
      </ul>
    </details>
    <p class="community__source">{{ t('communityPlaces.source') }}</p>
  </section>
</template>

<style scoped>
.community__list summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  min-height: var(--nr-target);
  padding: 0.5rem 0;
  cursor: pointer;
  list-style: none;
}

.community__list summary::-webkit-details-marker {
  display: none;
}

.community__count {
  font-size: 1.0625rem;
}

.community__open {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--nr-wine-text);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.community__chevron {
  flex: none;
  transition: transform 0.15s ease;
}

.community__list[open] .community__chevron {
  transform: rotate(180deg);
}

.community__list ul {
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
}

.community__list li {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
  border-top: 1px solid var(--nr-line);
}

.community__about {
  color: var(--nr-ink-muted);
}

.community__source {
  margin: 0.5rem 0 0;
  color: var(--nr-rust);
  font-size: 0.9375rem;
}

@media (prefers-reduced-motion: reduce) {
  .community__chevron {
    transition: none;
  }
}
</style>
