<script setup lang="ts" generic="T extends string | number">
import { computed, useId } from 'vue'
import { Check, CircleAlert } from '@lucide/vue'
import type { ChoiceOption } from '@/types'

// same idea as RadioGroup but for pick-any questions, like which payments
// someone gets. native checkboxes, so space toggles and the state is announced

const model = defineModel<T[]>({ required: true })

const props = withDefaults(
  defineProps<{
    options: ChoiceOption<T>[]
    legend: string
    id?: string
    legendTag?: 'h1' | 'h2' | 'span'
    hint?: string
    error?: string
  }>(),
  { id: undefined, legendTag: 'span', hint: undefined, error: undefined },
)

const generated = useId()
const groupId = computed(() => props.id ?? generated)
const hintId = computed(() => `${groupId.value}-hint`)
const errorId = computed(() => `${groupId.value}-error`)
const describedBy = computed(
  () =>
    [props.hint ? hintId.value : null, props.error ? errorId.value : null]
      .filter(Boolean)
      .join(' ') || undefined,
)
</script>

<template>
  <fieldset
    class="choice-group choice-group--chip"
    :class="{ 'choice-group--invalid': error }"
    :aria-describedby="describedBy"
  >
    <legend>
      <component :is="legendTag" :class="{ 'legend-heading': legendTag !== 'h1' }">
        {{ legend }}
      </component>
    </legend>

    <p v-if="hint" :id="hintId" class="field__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="field__error">
      <CircleAlert :size="18" aria-hidden="true" />
      {{ error }}
    </p>

    <div class="choice-group__options">
      <label v-for="(option, index) in options" :key="String(option.value)" class="choice">
        <input
          :id="index === 0 ? `${groupId}-first` : undefined"
          v-model="model"
          type="checkbox"
          class="choice__input"
          :name="groupId"
          :value="option.value"
        />
        <span class="choice__body">
          <span class="choice__icon" aria-hidden="true">
            <Check v-if="model.includes(option.value)" :size="18" :stroke-width="3" />
          </span>
          <component
            :is="option.icon"
            v-if="option.icon"
            class="choice__symbol"
            :size="22"
            aria-hidden="true"
          />
          <span class="choice__text">
            <span class="choice__label" :lang="option.lang" :dir="option.dir">{{
              option.label
            }}</span>
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
