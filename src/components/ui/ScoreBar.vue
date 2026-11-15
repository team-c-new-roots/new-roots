<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

/* one row of "why it ranks here". the bar is decoration, the number is the
   information, and a screen reader hears "92 out of 100" rather than "92".
   a topic that isn't counted still shows its score, with the reason under
   the bar so a low number never looks like it pulled the match down */

defineProps<{
  label: string
  score: number | null
  // why it isn't counted, when it isn't
  note?: string
  icon?: Component
  // tighter rows for the map panel, so all seven fit beside the map
  compact?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div class="score" :class="{ 'score--compact': compact }">
    <dt class="score__label">
      <component :is="icon" v-if="icon" :size="20" class="score__icon" aria-hidden="true" />
      {{ label }}
    </dt>
    <template v-if="score !== null">
      <dd class="score__value">
        <span aria-hidden="true">{{ score }}</span>
        <span class="visually-hidden">{{ t('suburb.scoreOutOf', { score }) }}</span>
      </dd>
      <dd class="score__track" :class="{ 'score__track--muted': note }" aria-hidden="true">
        <span class="score__fill" :style="{ inlineSize: `${score}%` }"></span>
      </dd>
    </template>
    <dd v-if="note" class="score__note">{{ note }}</dd>
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.0625rem;
}

.score__icon {
  flex: none;
  color: var(--nr-rust);
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

/* not counted, so the bar steps back and the note says why */
.score__track--muted .score__fill {
  background: var(--nr-ink-muted);
}

.score--compact {
  padding-block: 0.3rem;
}

.score--compact .score__label,
.score--compact .score__value {
  font-size: 1rem;
}

.score--compact .score__note {
  font-size: 0.875rem;
}
</style>
