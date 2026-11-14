<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/* words as well as colour, so the map still reads for someone who can't tell
   the shades apart. on a wide screen it floats inside the map like the data
   team's, on a phone it sits under the map so it doesn't cover any suburbs */

defineProps<{
  floating?: boolean
  // only explain markings the map is actually showing
  showNoRent?: boolean
  showNoScore?: boolean
}>()

const { t } = useI18n()
const steps = [1, 2, 3, 4, 5]
</script>

<template>
  <div class="map-legend" :class="{ 'map-legend--floating': floating }">
    <p id="map-legend-title" class="map-legend__title">{{ t('map.legend') }}</p>
    <div class="map-legend__swatches" aria-hidden="true">
      <span v-for="step in steps" :key="step" :class="`map-legend__swatch--${step}`"></span>
    </div>
    <div class="map-legend__ends">
      <span>{{ t('map.weaker') }}</span>
      <span>{{ t('map.stronger') }}</span>
    </div>
    <p v-if="showNoRent" class="map-legend__extra">
      <span class="map-legend__dashed" aria-hidden="true"></span>
      <span>{{ t('map.noRent') }}</span>
    </p>
    <p v-if="showNoScore" class="map-legend__extra">
      <span class="map-legend__hatch" aria-hidden="true"></span>
      <span>{{ t('map.noScore') }}</span>
    </p>
  </div>
</template>

<style scoped>
.map-legend {
  max-width: 22rem;
}

.map-legend--floating {
  position: absolute;
  inset-inline-start: 0.75rem;
  bottom: 0.75rem;
  z-index: 2;
  width: 16rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--nr-radius-sm);
  background: var(--nr-surface-raised);
  box-shadow: 0 2px 10px rgb(48 38 34 / 0.18);
}

.map-legend__title {
  margin: 0 0 0.5rem;
  font-weight: 700;
}

.map-legend__swatches {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.25rem;
}

.map-legend__swatches span,
.map-legend__dashed,
.map-legend__hatch {
  display: block;
  height: 1.25rem;
  border: 1px solid var(--nr-map-line);
  border-radius: 0.3rem;
}

.map-legend__swatch--1 {
  background: var(--nr-map-1);
}

.map-legend__swatch--2 {
  background: var(--nr-map-2);
}

.map-legend__swatch--3 {
  background: var(--nr-map-3);
}

.map-legend__swatch--4 {
  background: var(--nr-map-4);
}

.map-legend__swatch--5 {
  background: var(--nr-map-5);
}

.map-legend__ends {
  display: flex;
  justify-content: space-between;
  margin-top: 0.2rem;
  font-size: 0.875rem;
}

.map-legend__extra {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  line-height: 1.3;
}

.map-legend__dashed,
.map-legend__hatch {
  flex: none;
  width: 2rem;
}

.map-legend__dashed {
  border: 2px dashed var(--nr-map-line);
  background: var(--nr-map-2);
}

.map-legend__hatch {
  background: repeating-linear-gradient(
    -45deg,
    var(--nr-map-bg) 0 4px,
    var(--nr-ink-muted) 4px 6px
  );
}
</style>
