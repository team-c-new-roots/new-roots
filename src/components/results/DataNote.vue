<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarClock, ChevronDown, House, Info, MapPin, Signpost } from '@lucide/vue'
import { DATASETS, DATA_UPDATED } from '@/data/datasets'
import { useFormat } from '@/composables/useFormat'

/* what the figures can and can't tell you, right where people read them, so
   nobody has to find How it works first (panel feedback). Greater Melbourne
   only, what a median rent means, how fresh the data is and how often it
   changes, and that this is a starting point rather than the only source.
   it sits under the list and starts folded, so the map and suburbs come
   first. the line at the top of the results page says how fresh the data
   is and opens this */

withDefaults(defineProps<{ count?: number; compact?: boolean }>(), {
  count: undefined,
  compact: false,
})

const { t } = useI18n()
const { fullDate } = useFormat()
const open = ref(false)

// the periods behind the three figures people ask about most. this used to
// sit under the map, where it only showed on the map tab
const SOURCES = [
  ['rents', 'rental-report'],
  ['census', 'census'],
  ['crime', 'crime'],
] as const
const sourcesLine = computed(() =>
  SOURCES.map(([key, id]) => {
    const period = DATASETS.find((dataset) => dataset.id === id)?.period ?? ''
    return `${t(`map.sources.${key}`)}: ${period}`
  }).join(' · '),
)
</script>

<template>
  <p v-if="compact" class="data-note data-note--compact">
    <CalendarClock :size="18" aria-hidden="true" />
    <span>
      {{ t('dataNote.updated', { date: fullDate(DATA_UPDATED) }) }}
      {{ t('dataNote.startingPoint') }}
      <RouterLink :to="{ name: 'how-it-works', hash: '#updates' }">{{
        t('dataNote.more')
      }}</RouterLink>
    </span>
  </p>
  <details v-else class="data-note" @toggle="open = ($event.target as HTMLDetailsElement).open">
    <summary>
      <Info :size="22" aria-hidden="true" />
      <span class="data-note__summary">
        <span class="data-note__title">{{ t('dataNote.title') }}</span>
        <span class="data-note__hint">{{
          open ? t('dataNote.hintOpen') : t('dataNote.hint')
        }}</span>
      </span>
      <ChevronDown class="data-note__chevron" :size="22" aria-hidden="true" />
    </summary>
    <ul>
      <li>
        <MapPin :size="18" aria-hidden="true" />
        <span>{{ count ? t('dataNote.coverage', { count }) : t('dataNote.coverageShort') }}</span>
      </li>
      <li>
        <House :size="18" aria-hidden="true" />
        <span>{{ t('dataNote.rents') }}</span>
      </li>
      <li>
        <CalendarClock :size="18" aria-hidden="true" />
        <span>
          {{ t('dataNote.updated', { date: fullDate(DATA_UPDATED) }) }}
          {{ t('dataNote.schedule') }}
        </span>
      </li>
      <li>
        <Signpost :size="18" aria-hidden="true" />
        <span>{{ t('dataNote.startingPoint') }}</span>
      </li>
    </ul>
    <p class="data-note__sources">
      <strong>{{ t('map.dataFrom') }}</strong> {{ sourcesLine }}.
    </p>
    <p class="data-note__links">
      <RouterLink :to="{ name: 'how-it-works', hash: '#data' }">
        {{ t('map.allSources') }}
      </RouterLink>
      <RouterLink :to="{ name: 'how-it-works', hash: '#updates' }">
        {{ t('dataNote.more') }}
      </RouterLink>
    </p>
  </details>
</template>

<style scoped>
.data-note {
  margin: 0;
  padding: 0.25rem 1.25rem;
  border-inline-start: 5px solid var(--nr-rust);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-panel);
}

.data-note summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 3.5rem;
  cursor: pointer;
  list-style: none;
}

.data-note summary::-webkit-details-marker {
  display: none;
}

.data-note__summary {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.data-note__title {
  color: var(--nr-wine-text);
  font-weight: 700;
}

.data-note__hint {
  font-size: 0.9375rem;
}

.data-note__chevron {
  flex: none;
  transition: transform 0.15s ease;
}

.data-note[open] .data-note__chevron {
  transform: rotate(180deg);
}

.data-note[open] {
  padding-bottom: 0.75rem;
}

.data-note summary svg,
.data-note li svg {
  flex: none;
  color: var(--nr-rust);
}

.data-note ul {
  margin: 0 0 0.25rem;
  padding: 0;
  list-style: none;
}

.data-note li {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding-block: 0.25rem;
}

.data-note li svg {
  margin-top: 0.2rem;
}

.data-note__sources {
  margin: 0.5rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--nr-line);
}

.data-note__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1.5rem;
  margin: 0;
}

.data-note__links a {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
}

.data-note--compact {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
}

.data-note--compact svg {
  flex: none;
  margin-top: 0.15rem;
  color: var(--nr-rust);
}
</style>
