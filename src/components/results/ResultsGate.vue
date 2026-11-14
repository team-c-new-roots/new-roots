<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LoaderCircle, RefreshCw } from '@lucide/vue'
import type { ResultsStatus } from '@/stores/results'
import type { ResultsErrorKind } from '@/services/api'

/* stands in front of anything built from the scoring API's answer. sample
   data never failed, a network call can, so there's a loading state, an
   error that says what to do, and a button to try again */

defineProps<{ status: ResultsStatus; errorKind: ResultsErrorKind | null }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <slot v-if="status === 'ready'" />

  <div v-else-if="status === 'error'" class="gate gate--error" role="alert">
    <h2 class="gate__title">{{ t('results.errorTitle') }}</h2>
    <p>
      {{ errorKind === 'network' ? t('results.errorNetwork') : t('results.errorServer') }}
    </p>
    <button type="button" class="btn btn--primary" @click="emit('retry')">
      <RefreshCw :size="20" aria-hidden="true" />
      {{ t('results.retry') }}
    </button>
  </div>

  <div v-else class="gate" role="status" aria-live="polite">
    <LoaderCircle class="gate__spinner" :size="32" aria-hidden="true" />
    <p>{{ t('results.loading') }}</p>
  </div>
</template>

<style scoped>
.gate {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 2.5rem 1rem;
  border-radius: var(--nr-radius);
  background: var(--nr-panel);
  text-align: center;
}

.gate p {
  margin: 0;
}

.gate--error {
  justify-items: start;
  border-inline-start: 6px solid var(--nr-wine);
  text-align: start;
}

.gate__title {
  margin: 0;
  font-size: 1.375rem;
}

.gate__spinner {
  color: var(--nr-wine);
  animation: gate-spin 1s linear infinite;
}

@keyframes gate-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gate__spinner {
    animation: none;
  }
}
</style>
