<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/* words as well as colour, and hatching for missing data, so the map still
   reads for someone who can't tell the shades apart */

const { t } = useI18n()
const steps = [1, 2, 3, 4, 5]
</script>

<template>
  <div class="map-legend">
    <p id="map-legend-title" class="map-legend__title">{{ t('map.legend') }}</p>
    <div class="map-legend__row">
      <div class="map-legend__ramp">
        <div class="map-legend__swatches" aria-hidden="true">
          <span v-for="step in steps" :key="step" :class="`map-legend__swatch--${step}`"></span>
        </div>
        <div class="map-legend__ends">
          <span>{{ t('map.weaker') }}</span>
          <span>{{ t('map.stronger') }}</span>
        </div>
      </div>
      <div class="map-legend__nodata">
        <span class="map-legend__hatch" aria-hidden="true"></span>
        <span>{{ t('map.noData') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-legend__title {
  margin-bottom: 0.5rem;
  font-weight: 700;
}

.map-legend__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem 2rem;
}

.map-legend__swatches {
  display: flex;
  gap: 0.35rem;
}

.map-legend__swatches span,
.map-legend__hatch {
  display: block;
  width: 2.5rem;
  height: 1.5rem;
  border: 1px solid var(--nr-map-line);
  border-radius: 0.35rem;
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
  font-size: 0.9375rem;
}

.map-legend__nodata {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
}

.map-legend__hatch {
  background: repeating-linear-gradient(
    -45deg,
    var(--nr-map-bg) 0 4px,
    var(--nr-ink-muted) 4px 6px
  );
}
</style>
