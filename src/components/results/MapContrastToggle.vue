<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Contrast } from '@lucide/vue'
import { useDisplayStore } from '@/stores/display'

/* swaps the map's five match colours for the colour-blind safe ramp, and
   nothing else on the page. aria-pressed so a screen reader says on or off,
   and the words change too */

const { t } = useI18n()
const display = useDisplayStore()
</script>

<template>
  <button
    type="button"
    class="map-contrast"
    :aria-pressed="display.mapContrast ? 'true' : 'false'"
    @click="display.toggleMapContrast()"
  >
    <Contrast :size="18" aria-hidden="true" />
    <span>{{ t('map.contrast') }}</span>
    <span class="map-contrast__state">{{
      display.mapContrast ? t('map.contrastOn') : t('map.contrastOff')
    }}</span>
  </button>
</template>

<style scoped>
/* matches the Street map button above it */
.map-contrast {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--nr-target);
  padding: 0 1rem;
  border: 2px solid var(--nr-wine-line);
  border-radius: var(--nr-radius-pill);
  background: var(--nr-cream);
  color: var(--nr-wine-text);
  font: inherit;
  font-weight: 700;
  box-shadow: 0 2px 8px rgb(48 38 34 / 0.18);
  cursor: pointer;
}

.map-contrast:hover {
  background: var(--nr-apricot);
}

.map-contrast[aria-pressed='true'] {
  background: var(--nr-wine);
  color: var(--nr-cream);
}

.map-contrast__state {
  font-weight: 400;
}

.map-contrast__state::before {
  content: '·';
  margin-inline-end: 0.4rem;
}
</style>
