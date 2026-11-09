<script setup lang="ts">
import { computed } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { Check, ChevronLeft, Lock, Printer } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useResults } from '@/composables/useResults'
import { useFormat } from '@/composables/useFormat'
import type { RankedSuburb } from '@/types'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import logoLight1x from '@/assets/brand/logo-on-light.webp'
import logoLight2x from '@/assets/brand/logo-on-light@2x.webp'

/* the page someone takes to a caseworker (US-5). household, budget and
   shortlist, and nothing that identifies them. printing goes through the
   browser's own print dialog, which also offers Save as PDF, so the summary
   never leaves the device unless they choose to send it */

const { t, d } = useI18n()
const answers = useAnswersStore()
const { result } = useResults()
const { money, home } = useFormat()

const budget = computed(() => answers.budget)

// the suburbs they added from a details page, in the order they added them,
// or the top three if they haven't added any
const picks = computed<RankedSuburb[]>(() => {
  const all = result.value?.all ?? []
  const chosen = answers.shortlist
    .map((id) => all.find((item) => item.suburb.id === id))
    .filter((item): item is RankedSuburb => item !== undefined)
  return chosen.length > 0 ? chosen : (result.value?.ranked.slice(0, 3) ?? [])
})

const householdLine = computed(() =>
  t('summary.people', {
    adults: t('units.adults', answers.adults),
    children: t('units.children', answers.children),
    home: home({ type: answers.homeType, bedrooms: answers.bedrooms }),
  }),
)

const today = computed(() => d(new Date(), 'long'))

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

    <h1>{{ t('summary.title') }}</h1>
    <p class="lead">{{ t('summary.lead') }}</p>

    <section class="panel summary__block" aria-labelledby="household-heading">
      <h2 id="household-heading">{{ t('summary.household') }}</h2>
      <p>{{ householdLine }}</p>
      <p v-if="budget">
        {{
          budget.rentAssistanceWeekly > 0
            ? t('summary.budgetWithRa', { amount: money(budget.weekly) })
            : t('summary.budget', { amount: money(budget.weekly) })
        }}
      </p>
    </section>

    <section class="panel summary__block" aria-labelledby="suburbs-heading">
      <h2 id="suburbs-heading">{{ t('summary.suburbs') }}</h2>
      <template v-if="picks.length">
        <p class="muted">
          {{ answers.shortlist.length ? t('summary.yourPicks') : t('summary.topThree') }}
        </p>
        <ol class="summary__suburbs">
          <li v-for="(item, index) in picks" :key="item.suburb.id">
            <span class="summary__number" aria-hidden="true">{{ index + 1 }}</span>
            <span class="summary__name">{{ item.suburb.name }}</span>
            <span v-if="item.median !== null" class="summary__rent">
              {{ t('income.budgetValue', { amount: money(item.median) }) }}
            </span>
            <span class="summary__status">{{ t(`status.${item.status}`) }}</span>
          </li>
        </ol>
      </template>
      <p v-else>{{ t('summary.noSuburbs') }}</p>
    </section>

    <section aria-labelledby="next-heading">
      <h2 id="next-heading">{{ t('summary.nextSteps') }}</h2>
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
    <p class="muted summary__made">{{ t('summary.made', { date: today }) }}</p>

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

.summary__suburbs li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  padding-block: 0.4rem;
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
