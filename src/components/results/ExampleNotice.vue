<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Info } from '@lucide/vue'
import { usingExample } from '@/services/api'

// until the scoring API is live, every results screen says plainly that it's
// showing a saved example, so nobody mistakes it for their own ranking
const { t } = useI18n()
</script>

<template>
  <div v-if="usingExample" class="example-notice" role="note">
    <Info :size="22" aria-hidden="true" />
    <p>
      <strong>{{ t('example.title') }}.</strong>
      {{ t('example.body') }}
    </p>
  </div>
</template>

<style scoped>
.example-notice {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 1.25rem;
  padding: 0.85rem 1rem;
  border: 2px solid var(--nr-rust);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-surface-raised);
}

.example-notice svg {
  flex: none;
  margin-top: 0.1rem;
  color: var(--nr-rust);
}

.example-notice p {
  margin: 0;
}
</style>
