<script setup lang="ts">
import { computed } from 'vue'
import { CircleAlert } from '@lucide/vue'

// one labelled input with its hint and error wired up, so the aria plumbing
// is written once. the id is required because the error summary links to it

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    hint?: string
    error?: string
    prefix?: string
    inputmode?: 'text' | 'decimal' | 'numeric'
    autocomplete?: string
  }>(),
  { hint: undefined, error: undefined, prefix: undefined, inputmode: 'text', autocomplete: 'off' },
)

const hintId = computed(() => `${props.id}-hint`)
const errorId = computed(() => `${props.id}-error`)
const describedBy = computed(
  () =>
    [props.hint ? hintId.value : null, props.error ? errorId.value : null]
      .filter(Boolean)
      .join(' ') || undefined,
)
</script>

<template>
  <div class="field">
    <label :for="id" class="field__label">{{ label }}</label>
    <p v-if="hint" :id="hintId" class="field__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="field__error">
      <CircleAlert :size="18" aria-hidden="true" />
      {{ error }}
    </p>
    <div class="field__control" :class="{ 'field__control--invalid': error }">
      <span v-if="prefix" class="field__prefix" aria-hidden="true">{{ prefix }}</span>
      <input
        :id="id"
        v-model="model"
        class="field__input"
        type="text"
        :inputmode="inputmode"
        :autocomplete="autocomplete"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
      />
    </div>
  </div>
</template>
