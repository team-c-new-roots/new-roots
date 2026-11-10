<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFormat } from '@/composables/useFormat'
import type { BudgetEstimate } from '@/types'

/* the budget shows up the moment there's enough to work it out (US-2), in
   dollars a week. a polite live region, so a screen reader hears the new
   figure after each change without being interrupted mid-word */

defineProps<{ budget: BudgetEstimate | null }>()

const { t } = useI18n()
const { money } = useFormat()
</script>

<template>
  <div class="budget-card" aria-live="polite">
    <template v-if="budget">
      <p class="budget-card__label">{{ t('income.budgetLabel') }}</p>
      <p class="budget-card__value">
        {{ t('income.budgetValue', { amount: money(budget.weekly) }) }}
      </p>
      <p class="budget-card__note">
        {{
          budget.rentAssistanceWeekly > 0
            ? t('income.withRentAssistance')
            : t('income.withoutRentAssistance')
        }}
        {{ t('income.sampleFigure') }}
      </p>
      <RouterLink :to="{ name: 'how-it-works', hash: '#budget' }">
        {{ t('income.howWorked') }}
      </RouterLink>
    </template>
    <p v-else class="budget-card__empty">{{ t('income.budgetEmpty') }}</p>
  </div>
</template>

<style scoped>
.budget-card {
  margin-top: 0.5rem;
  padding: 1rem 1.25rem;
  border-inline-start: 6px solid var(--nr-wine);
  border-radius: var(--nr-radius);
  background: var(--nr-panel);
}

.budget-card__label,
.budget-card__value,
.budget-card__empty {
  margin: 0;
}

.budget-card__value {
  color: var(--nr-wine);
  font-size: clamp(1.75rem, 1.5rem + 1vw, 2.25rem);
  font-weight: 700;
  line-height: 1.2;
}

.budget-card__note {
  margin: 0 0 0.25rem;
  font-size: 0.9375rem;
}

.budget-card__empty {
  color: var(--nr-ink-muted);
}
</style>
