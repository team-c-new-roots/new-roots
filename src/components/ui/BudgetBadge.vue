<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, CircleQuestionMark, EqualApproximately, X } from '@lucide/vue'
import type { BudgetStatus } from '@/types'

// icon plus words, so the budget status never relies on colour alone
const props = defineProps<{ status: BudgetStatus }>()
const { t } = useI18n()

const icon = computed(
  () =>
    ({ within: Check, close: EqualApproximately, above: X, noData: CircleQuestionMark })[
      props.status
    ],
)
</script>

<template>
  <span class="badge" :class="`badge--${status.toLowerCase()}`">
    <component :is="icon" :size="16" :stroke-width="3" aria-hidden="true" />
    {{ t(`status.${status}`) }}
  </span>
</template>
