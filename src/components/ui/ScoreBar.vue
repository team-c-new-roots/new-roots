<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/* one row of "why it ranks here". the bar is decoration, the number is the
   information, and a screen reader hears "92 out of 100" rather than "92".
   when a topic isn't counted the row says why instead of showing a bar */

defineProps<{
  label: string
  score: number | null
  // why it isn't counted, when it isn't
  note?: string
}>()

const { t } = useI18n()
</script>

<template>
  <div class="score">
    <dt class="score__label">{{ label }}</dt>
    <dd v-if="note" class="score__note">{{ note }}</dd>
    <template v-else-if="score !== null">
      <dd class="score__value">
        <span aria-hidden="true">{{ score }}</span>
        <span class="visually-hidden">{{ t('suburb.scoreOutOf', { score }) }}</span>
      </dd>
      <dd class="score__track" aria-hidden="true">
        <span class="score__fill" :style="{ inlineSize: `${score}%` }"></span>
      </dd>
    </template>
  </div>
</template>

<style scoped>
.score {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 0.25rem 1rem;
  padding-block: 0.6rem;
}

.score__label {
  font-size: 1.0625rem;
}

.score__value {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
}

.score__note {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--nr-rust);
  font-size: 0.9375rem;
  font-weight: 700;
}

.score__track {
  grid-column: 1 / -1;
  height: 0.75rem;
  margin: 0;
  overflow: hidden;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-apricot);
}

.score__fill {
  display: block;
  height: 100%;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-wine);
}
</style>
