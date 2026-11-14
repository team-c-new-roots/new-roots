<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Layers } from '@lucide/vue'
import { MATCH_BANDS } from '@/services/results'

/* the key under the map. colours with the score range each one covers, then
   what the three kinds of label mean, so a group count or a numbered pin is
   never a guess. words as well as colour throughout */

defineProps<{
  // only explain markings the map is actually showing
  showNoRent?: boolean
  showNoScore?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div class="map-legend">
    <div class="map-legend__part">
      <p id="map-legend-title" class="map-legend__title">{{ t('map.legend') }}</p>
      <ul class="map-legend__bands">
        <li v-for="band in MATCH_BANDS" :key="band.band">
          <span
            :class="`map-legend__swatch map-legend__swatch--${band.band}`"
            aria-hidden="true"
          ></span>
          <span>{{ band.from }}–{{ band.to }}</span>
        </li>
      </ul>
      <p v-if="showNoRent" class="map-legend__extra">
        <span class="map-legend__dashed" aria-hidden="true"></span>
        <span>{{ t('map.noRent') }}</span>
      </p>
      <p v-if="showNoScore" class="map-legend__extra">
        <span class="map-legend__hatch" aria-hidden="true"></span>
        <span>{{ t('map.noScore') }}</span>
      </p>
    </div>

    <div class="map-legend__part">
      <p class="map-legend__title">{{ t('map.keyLabels') }}</p>
      <ul class="map-legend__labels">
        <li>
          <span class="key-pin" aria-hidden="true"><span>1</span></span>
          <span>{{ t('map.keyTop') }}</span>
        </li>
        <li>
          <span class="key-score" aria-hidden="true">62</span>
          <span>{{ t('map.keyScore') }}</span>
        </li>
        <li>
          <span class="key-group" aria-hidden="true">
            <Layers :size="13" :stroke-width="2.5" />
            {{ t('map.groupCount', { n: 12 }) }}
          </span>
          <span>{{ t('map.keyGroup') }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.map-legend {
  display: grid;
  gap: 1.25rem;
}

.map-legend__title {
  margin: 0 0 0.5rem;
  font-weight: 700;
}

.map-legend__bands {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.25rem;
  max-width: 24rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8125rem;
  text-align: center;
}

.map-legend__swatch,
.map-legend__dashed,
.map-legend__hatch {
  display: block;
  height: 1.25rem;
  border: 1px solid var(--nr-map-line);
  border-radius: 0.3rem;
}

.map-legend__swatch {
  margin-bottom: 0.15rem;
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

.map-legend__extra {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.6rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.3;
}

.map-legend__dashed,
.map-legend__hatch {
  flex: none;
  width: 2.25rem;
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

.map-legend__labels {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
}

.map-legend__labels li {
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  align-items: center;
  gap: 0.6rem;
}

/* small copies of the map's labels, drawn the same way */
.key-pin,
.key-score,
.key-group {
  justify-self: start;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
}

.key-pin {
  display: inline-flex;
  padding: 0.15rem;
  border: 2px solid var(--nr-cream);
  border-radius: 999px;
  background: var(--nr-wine);
  box-shadow: 0 1px 4px rgb(48 38 34 / 0.35);
}

.key-pin span {
  display: inline-grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--nr-cream);
  color: var(--nr-wine);
  line-height: 1;
}

.key-score {
  padding: 0.1rem 0.5rem;
  border: 2px solid var(--nr-espresso);
  border-radius: 999px;
  background: var(--nr-cream);
}

.key-group {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.45rem;
  border: 2px dashed var(--nr-espresso);
  border-radius: 999px;
  background: var(--nr-apricot);
  box-shadow:
    3px 3px 0 -1px var(--nr-apricot),
    3px 3px 0 1px var(--nr-espresso);
}

@media (min-width: 48rem) {
  .map-legend {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 2rem;
  }
}
</style>
