<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Contrast } from '@lucide/vue'
import { useDisplayStore } from '@/stores/display'

/* one switch for the whole site. aria-pressed so a screen reader says on or
   off, and the words change too so it doesn't rely on the fill */

withDefaults(defineProps<{ variant?: 'plain' | 'map' }>(), { variant: 'plain' })

const { t } = useI18n()
const display = useDisplayStore()
</script>

<template>
  <button
    type="button"
    class="contrast-toggle"
    :class="`contrast-toggle--${variant}`"
    :aria-pressed="display.highContrast ? 'true' : 'false'"
    @click="display.toggleContrast()"
  >
    <Contrast :size="18" aria-hidden="true" />
    <span>{{ t('contrast.label') }}</span>
    <span class="contrast-toggle__state">{{
      display.highContrast ? t('contrast.on') : t('contrast.off')
    }}</span>
  </button>
</template>

<style scoped>
.contrast-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--nr-target);
  padding: 0 1rem;
  border: 2px solid var(--nr-wine);
  border-radius: var(--nr-radius-pill);
  background: var(--nr-surface-raised);
  color: var(--nr-wine);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.contrast-toggle:hover {
  background: var(--nr-apricot);
}

.contrast-toggle[aria-pressed='true'] {
  background: var(--nr-wine);
  color: var(--nr-cream);
}

.contrast-toggle__state {
  font-weight: 400;
}

.contrast-toggle__state::before {
  content: '·';
  margin-inline-end: 0.4rem;
}

/* sits on the map under Street map, with the same shadow */
.contrast-toggle--map {
  box-shadow: 0 2px 8px rgb(48 38 34 / 0.18);
}
</style>
