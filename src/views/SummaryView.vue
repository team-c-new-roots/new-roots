<script setup lang="ts">
import { computed } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { Check, ChevronLeft, ListChecks, Lock, MapPin, Printer, Users } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useResults } from '@/composables/useResults'
import { useFormat } from '@/composables/useFormat'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import { usingExample } from '@/services/api'
import type { SuburbResult } from '@/services/results'
import { RATES_FROM } from '@/data/centrelink-rates'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import ResultsGate from '@/components/results/ResultsGate.vue'
import ExampleNotice from '@/components/results/ExampleNotice.vue'
import logoLight1x from '@/assets/brand/logo-on-light.webp'
import logoLight2x from '@/assets/brand/logo-on-light@2x.webp'

/* the page someone takes to a caseworker (US 2.4). household, budget and up
   to three suburbs with their rent and the distances that matter, and nothing
   that identifies them. fits on one A4 page. printing goes through the
   browser's own print dialog, which also offers Save as PDF, so the summary
   never leaves the device unless they choose to send it */

const { t, d } = useI18n()
const answers = useAnswersStore()
const { status, errorKind, derived, retry } = useResults()
const { money, home } = useFormat()
const facts = useSuburbFacts()

const budget = computed(() => answers.budget)
const usesPayments = computed(
  () => answers.incomeSource === 'payments' || answers.incomeSource === 'both',
)

// the suburbs they added from a details page, in the order they added them,
// or the top three if they haven't added any
const picks = computed<SuburbResult[]>(() => {
  const found = derived.value
  if (!found) return []
  const chosen = answers.shortlist
    .map((id) => found.byId.get(id))
    .filter((item): item is SuburbResult => item !== undefined)
  return chosen.length > 0 ? chosen : found.ranked.slice(0, 3)
})

function distances(item: SuburbResult): string[] {
  return [...facts.schoolLines(item), facts.englishLine(item)].filter(
    (line): line is string => line !== null,
  )
}

const householdLine = computed(() =>
  t('summary.people', {
    adults: t('units.adults', answers.adults),
    children: t('units.children', answers.children),
    home: home(answers.home.asked),
  }),
)

const today = computed(() => d(new Date(), 'long'))
const madeKey = usingExample ? 'summary.madeExample' : 'summary.made'

function print() {
  window.print()
}
</script>

<template>
  <div class="page page--narrow summary">
    <img
      class="print-only summary__logo"
      :src="logoLight1x"
      :srcset="`${logoLight1x} 1x, ${logoLight2x} 2x`"
      :alt="t('app.name')"
      width="173"
      height="40"
    />

    <ExampleNotice class="no-print" />
    <h1>{{ t('summary.title') }}</h1>
    <p class="lead">{{ t('summary.lead') }}</p>

    <section class="panel summary__block" aria-labelledby="household-heading">
      <h2 id="household-heading" class="summary__heading">
        <Users :size="24" aria-hidden="true" />
        {{ t('summary.household') }}
      </h2>
      <p>{{ householdLine }}</p>
      <p v-if="budget">
        {{
          budget.rentAssistanceWeekly > 0
            ? t('summary.budgetWithRa', { amount: money(budget.weekly) })
            : t('summary.budget', { amount: money(budget.weekly) })
        }}
      </p>
      <p v-if="usesPayments" class="muted">{{ t('summary.ratesFrom', { date: RATES_FROM }) }}</p>
    </section>

    <section class="panel summary__block" aria-labelledby="suburbs-heading">
      <h2 id="suburbs-heading" class="summary__heading">
        <MapPin :size="24" aria-hidden="true" />
        {{ t('summary.suburbs') }}
      </h2>
      <ResultsGate :status="status" :error-kind="errorKind" @retry="retry">
        <template v-if="picks.length">
          <p class="muted">
            {{ answers.shortlist.length ? t('summary.yourPicks') : t('summary.topThree') }}
          </p>
          <ol class="summary__suburbs">
            <li v-for="(item, index) in picks" :key="item.id">
              <div class="summary__row">
                <span class="summary__number" aria-hidden="true">{{ index + 1 }}</span>
                <span class="summary__name">{{ item.name }}</span>
                <span v-if="item.rent !== null" class="summary__rent">
                  {{ t('income.budgetValue', { amount: money(item.rent) }) }}
                </span>
                <span class="summary__status">{{ t(`status.${item.status}`) }}</span>
              </div>
              <p v-if="distances(item).length" class="summary__distances">
                {{ distances(item).join(' · ') }}
              </p>
            </li>
          </ol>
        </template>
        <p v-else>{{ t('summary.noSuburbs') }}</p>
      </ResultsGate>
    </section>

    <section aria-labelledby="next-heading">
      <h2 id="next-heading" class="summary__heading">
        <ListChecks :size="24" aria-hidden="true" />
        {{ t('summary.nextSteps') }}
      </h2>
      <ul class="icon-list">
        <li>
          <Check :size="22" aria-hidden="true" />
          <I18nT keypath="summary.step1" tag="span" scope="global">
            <template #realestate>
              <ExternalLink href="https://www.realestate.com.au/rent/"
                >realestate.com.au</ExternalLink
              >
            </template>
            <template #domain>
              <ExternalLink href="https://www.domain.com.au/rent/">Domain</ExternalLink>
            </template>
          </I18nT>
        </li>
        <li>
          <Check :size="22" aria-hidden="true" />
          <span>{{ t('summary.step2') }}</span>
        </li>
        <li>
          <Check :size="22" aria-hidden="true" />
          <I18nT keypath="summary.step3" tag="span" scope="global">
            <template #findMySchool>
              <ExternalLink href="https://www.findmyschool.vic.gov.au">Find My School</ExternalLink>
            </template>
          </I18nT>
        </li>
      </ul>
    </section>

    <p class="summary__privacy">
      <Lock :size="20" aria-hidden="true" />
      {{ t('summary.privacy') }}
    </p>
    <p class="muted summary__made">
      {{ t(madeKey, { date: today }) }}
    </p>

    <div class="no-print summary__actions">
      <button type="button" class="btn btn--accent btn--block" @click="print">
        <Printer :size="20" aria-hidden="true" />
        {{ t('summary.print') }}
      </button>
      <RouterLink :to="{ name: 'results' }" class="link-action">
        <ChevronLeft class="flip-rtl" :size="20" aria-hidden="true" />
        {{ t('summary.back') }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.summary__logo {
  margin-bottom: 1rem;
}

.summary__block {
  margin-bottom: 1.25rem;
}

.summary__block p {
  margin-bottom: 0.35rem;
}

.summary__suburbs {
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.summary__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary__heading svg {
  flex: none;
  color: var(--nr-rust);
}

.summary__suburbs li {
  padding-block: 0.4rem;
}

.summary__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
}

.summary__distances {
  margin: 0.2rem 0 0;
  padding-inline-start: 2.5rem;
  font-size: 0.9375rem;
}

.summary__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--nr-wine);
  color: var(--nr-cream);
  font-size: 0.875rem;
  font-weight: 700;
}

.summary__name {
  font-weight: 700;
}

.summary__status {
  margin-inline-start: auto;
  color: var(--nr-wine);
  font-weight: 700;
}

.summary__privacy {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.summary__privacy svg {
  flex: 0 0 auto;
  color: var(--nr-rust);
}

.summary__made {
  font-size: 0.9375rem;
}

.summary__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

@media print {
  .summary__number {
    border: 1px solid var(--nr-print-ink);
    background: var(--nr-print-paper);
    color: var(--nr-print-ink);
  }

  .summary__status {
    color: var(--nr-print-ink);
  }
}
</style>
