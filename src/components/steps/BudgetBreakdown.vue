<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calculator, X } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useFormat } from '@/composables/useFormat'
import { AFFORDABLE_SHARE } from '@/services/budget'
import { RATES_FROM } from '@/data/centrelink-rates'
import type { BudgetPart } from '@/types'
import ExternalLink from '@/components/ui/ExternalLink.vue'

/* US 1.1. "how we worked this out" for this household, not a general page.
   each amount that went in, the total, 30% of it, then the rounding, so a
   caseworker can check it line by line. a native dialog, so focus is trapped
   and Escape closes it. How it works still has the method for everyone */

withDefaults(defineProps<{ label?: string }>(), { label: undefined })

const { t } = useI18n()
const answers = useAnswersStore()
const { cents, money, monthYear } = useFormat()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
let returnTo: HTMLElement | null = null

const lines = computed(() => answers.budgetLines ?? [])
const income = computed(() => answers.budget?.incomeWeekly ?? 0)
const share = computed(() => income.value * AFFORDABLE_SHARE)
const usesPayments = computed(() => lines.value.some((line) => line.kind !== 'wage'))

function lineLabel(line: BudgetPart): string {
  switch (line.kind) {
    case 'payment': {
      const payment = t(`breakdown.payments.${line.payment}`)
      return answers.adults > 1 ? t('breakdown.adultPayment', { n: line.adult, payment }) : payment
    }
    case 'familyTax':
      return t('breakdown.familyTax')
    case 'rentAssistance':
      return t('breakdown.rentAssistance')
    case 'wage':
      return t('breakdown.wage')
  }
}

function lineNote(line: BudgetPart): string {
  switch (line.kind) {
    case 'payment':
      return line.payment === 'other' ? t('breakdown.otherNote') : t('breakdown.energyNote')
    case 'familyTax':
      return t('breakdown.familyTaxNote', { children: t('units.children', answers.children) })
    case 'rentAssistance':
      return t('breakdown.rentAssistanceNote')
    case 'wage':
      return line.period === 'week'
        ? t('breakdown.wageWeekly')
        : t(`breakdown.wageFrom.${line.period}`, { amount: cents(line.amount) })
  }
}

function open() {
  returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.value?.showModal()
}

function onClose() {
  returnTo?.focus()
  returnTo = null
}

// a click on the backdrop lands on the dialog itself
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}
</script>

<template>
  <button type="button" class="breakdown__open" @click="open">
    <Calculator :size="18" aria-hidden="true" />
    {{ label ?? t('income.howWorked') }}
  </button>

  <dialog
    ref="dialog"
    class="dialog breakdown"
    :aria-labelledby="titleId"
    @close="onClose"
    @click="onClick"
  >
    <div class="breakdown__head">
      <h2 :id="titleId">{{ t('breakdown.title') }}</h2>
      <button type="button" class="icon-button" @click="dialog?.close()">
        <X :size="24" aria-hidden="true" />
        <span class="visually-hidden">{{ t('breakdown.close') }}</span>
      </button>
    </div>

    <template v-if="answers.budget && lines.length">
      <p>{{ t('breakdown.lead') }}</p>
      <table class="breakdown__table">
        <caption class="visually-hidden">
          {{
            t('breakdown.caption')
          }}
        </caption>
        <thead class="visually-hidden">
          <tr>
            <th scope="col">{{ t('breakdown.what') }}</th>
            <th scope="col">{{ t('breakdown.perWeek') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, index) in lines" :key="index">
            <th scope="row">
              {{ lineLabel(line) }}
              <span class="breakdown__note">{{ lineNote(line) }}</span>
            </th>
            <td>{{ cents(line.weekly) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="breakdown__total">
            <th scope="row">{{ t('breakdown.total') }}</th>
            <td>{{ cents(income) }}</td>
          </tr>
          <tr>
            <th scope="row">
              {{ t('breakdown.share') }}
              <span class="breakdown__note">{{ t('breakdown.shareNote') }}</span>
            </th>
            <td>{{ cents(share) }}</td>
          </tr>
          <tr class="breakdown__result">
            <th scope="row">
              {{ t('breakdown.budget') }}
              <span class="breakdown__note">{{ t('breakdown.roundNote') }}</span>
            </th>
            <td>{{ money(answers.budget.weekly) }}</td>
          </tr>
        </tfoot>
      </table>
      <p v-if="usesPayments" class="breakdown__small">
        {{ t('breakdown.maxRates', { date: monthYear(RATES_FROM) }) }}
      </p>
      <p class="breakdown__links">
        <RouterLink :to="{ name: 'how-it-works', hash: '#budget' }" @click="dialog?.close()">
          {{ t('breakdown.method') }}
        </RouterLink>
        <ExternalLink v-if="usesPayments" href="https://www.servicesaustralia.gov.au/centrelink">
          {{ t('income.centrelinkLink') }}
        </ExternalLink>
      </p>
    </template>
    <p v-else>{{ t('income.budgetEmpty') }}</p>

    <div class="dialog__actions">
      <button type="button" class="btn btn--primary" @click="dialog?.close()">
        {{ t('breakdown.done') }}
      </button>
    </div>
  </dialog>
</template>

<style scoped>
/* looks like the links beside it, but opens the dialog */
.breakdown__open {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: var(--nr-target);
  padding: 0;
  border: 0;
  background: none;
  color: var(--nr-rust);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15em;
  cursor: pointer;
}

.breakdown__open:hover {
  color: var(--nr-wine-text);
}

.breakdown {
  width: min(34rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
}

.breakdown__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.breakdown__head h2 {
  margin-top: 0.6rem;
}

.breakdown__table {
  width: 100%;
  margin-bottom: 1rem;
  border-collapse: collapse;
}

.breakdown__table th,
.breakdown__table td {
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--nr-line);
  vertical-align: top;
}

.breakdown__table th {
  padding-inline-end: 1rem;
  font-weight: 700;
  text-align: start;
}

.breakdown__table td {
  white-space: nowrap;
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.breakdown__note {
  display: block;
  color: var(--nr-ink-muted);
  font-size: 0.9375rem;
  font-weight: 400;
}

.breakdown__total th,
.breakdown__total td {
  border-top: 2px solid var(--nr-ink);
}

.breakdown__result th,
.breakdown__result td {
  border-bottom: 0;
  color: var(--nr-wine-text);
  font-size: 1.125rem;
  font-weight: 700;
}

.breakdown__small {
  color: var(--nr-ink-muted);
  font-size: 0.9375rem;
}

.breakdown__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}

.breakdown__links a {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
}
</style>
