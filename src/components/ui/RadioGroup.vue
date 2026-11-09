<script setup lang="ts" generic="T extends string | number">
import { computed, useId } from 'vue'
import { Check, Circle, CircleAlert, CircleCheck } from '@lucide/vue'
import type { ChoiceOption } from '@/types'

/* native radios under the styling, so arrow keys, form semantics and the
   screen reader's "1 of 3" all come for free. the question goes in the legend,
   and when the question is the whole screen the legend holds the h1, the way
   GOV.UK does it, so the group is named by the question itself */

const model = defineModel<T | null>({ required: true })

const props = withDefaults(
  defineProps<{
    options: ChoiceOption<T>[]
    legend: string
    id?: string
    variant?: 'chip' | 'tile' | 'card' | 'card-strong' | 'language'
    legendTag?: 'h1' | 'h2' | 'span'
    legendHidden?: boolean
    hint?: string
    error?: string
  }>(),
  {
    id: undefined,
    variant: 'chip',
    legendTag: 'span',
    legendHidden: false,
    hint: undefined,
    error: undefined,
  },
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

const showsTick = computed(() => props.variant === 'chip')
const showsCircle = computed(() => props.variant === 'card' || props.variant === 'card-strong')
</script>

<template>
  <fieldset
    class="choice-group"
    :class="[`choice-group--${variant}`, { 'choice-group--invalid': error }]"
    :aria-describedby="describedBy"
  >
    <legend :class="{ 'visually-hidden': legendHidden }">
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
          type="radio"
          class="choice__input"
          :name="groupId"
          :value="option.value"
        />
        <span class="choice__body">
          <span
            v-if="$slots.icon || showsCircle || showsTick"
            class="choice__icon"
            aria-hidden="true"
          >
            <slot name="icon" :option="option" :checked="model === option.value">
              <template v-if="showsCircle">
                <CircleCheck v-if="model === option.value" :size="26" />
                <Circle v-else :size="26" />
              </template>
              <Check v-else-if="showsTick && model === option.value" :size="18" :stroke-width="3" />
            </slot>
          </span>
          <span class="choice__text">
            <span class="choice__label" :lang="option.lang" :dir="option.dir">{{
              option.label
            }}</span>
            <span v-if="option.hint" class="choice__hint">{{ option.hint }}</span>
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
