<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Contrast } from '@lucide/vue'
import { useDisplayStore } from '@/stores/display'

/* swaps the map's five match colours for the colour-blind safe ramp, and
   nothing else on the page. aria-pressed so a screen reader says on or off,
   and the words change too. styled with the other map tools in main.css */

const { t } = useI18n()
const display = useDisplayStore()
</script>

<template>
  <div class="map-tool-wrap">
    <button
      type="button"
      class="map-tool"
      :aria-pressed="display.mapContrast ? 'true' : 'false'"
      aria-describedby="map-tip-contrast"
      @click="display.toggleMapContrast()"
    >
      <Contrast class="map-tool__icon" :size="20" aria-hidden="true" />
      <span class="map-tool__label">{{ t('map.contrast') }}</span>
      <span class="map-tool__state">{{
        display.mapContrast ? t('map.contrastOn') : t('map.contrastOff')
      }}</span>
    </button>
    <span id="map-tip-contrast" class="map-tool__tip">{{ t('map.contrastTip') }}</span>
  </div>
</template>
