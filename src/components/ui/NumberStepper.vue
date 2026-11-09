<script setup lang="ts">
import { User, Minus, Plus } from '@lucide/vue'

/* minus and plus instead of typing, from the wireframe. the buttons use
   aria-disabled rather than disabled at the limits, so focus doesn't vanish
   from under a keyboard user when they hit zero. the visible number is hidden
   from screen readers and a live region says "3 adults" instead of just "3" */

const model = defineModel<number>({ required: true })

const props = defineProps<{
  id: string
  label: string
  hint?: string
  min: number
  max: number
  addLabel: string
  removeLabel: string
  // the count in words, like "3 adults"
  valueText: string
}>()

function change(step: number) {
  const next = model.value + step
  if (next < props.min || next > props.max) return
  model.value = next
}
</script>

<template>
  <div
    class="stepper"
    role="group"
    :aria-labelledby="`${id}-label`"
    :aria-describedby="hint ? `${id}-hint` : undefined"
  >
    <span class="stepper__icon" aria-hidden="true"><User :size="28" /></span>
    <span class="stepper__text">
      <span :id="`${id}-label`" class="stepper__label">{{ label }}</span>
      <span v-if="hint" :id="`${id}-hint`" class="stepper__hint">{{ hint }}</span>
    </span>
    <span class="stepper__controls">
      <button
        :id="`${id}-remove`"
        type="button"
        class="stepper__button"
        :aria-label="removeLabel"
        :aria-disabled="model <= min ? 'true' : undefined"
        @click="change(-1)"
      >
        <Minus :size="22" aria-hidden="true" />
      </button>
      <span class="stepper__value" aria-hidden="true">{{ model }}</span>
      <button
        :id="`${id}-add`"
        type="button"
        class="stepper__button"
        :aria-label="addLabel"
        :aria-disabled="model >= max ? 'true' : undefined"
        @click="change(1)"
      >
        <Plus :size="22" aria-hidden="true" />
      </button>
    </span>
    <span class="visually-hidden" aria-live="polite">{{ valueText }}</span>
  </div>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--nr-radius);
  background: var(--nr-panel);
}

.stepper__icon {
  display: inline-flex;
  color: var(--nr-orange);
}

.stepper__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.stepper__label {
  font-size: 1.125rem;
  font-weight: 700;
}

.stepper__hint {
  color: var(--nr-ink-muted);
  font-size: 0.9375rem;
}

.stepper__controls {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.stepper__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--nr-target);
  height: var(--nr-target);
  padding: 0;
  border: 2px solid var(--nr-wine);
  border-radius: 50%;
  background: transparent;
  color: var(--nr-wine);
  cursor: pointer;
}

.stepper__button:hover {
  background: var(--nr-apricot-strong);
}

/* greyed out, but still in the tab order. disabled controls are exempt from
   the contrast rules, this only signals there's nowhere further to go */
.stepper__button[aria-disabled='true'] {
  opacity: 0.4;
  cursor: not-allowed;
}

.stepper__value {
  min-width: 2ch;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
}

@media (max-width: 359.98px) {
  .stepper {
    padding-inline: 0.85rem;
    gap: 0.5rem;
  }

  .stepper__icon {
    display: none;
  }
}
</style>
