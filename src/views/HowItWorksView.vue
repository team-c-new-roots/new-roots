<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DATASETS, DATA_UPDATED } from '@/data/datasets'
import { useFormat } from '@/composables/useFormat'
import ExternalLink from '@/components/ui/ExternalLink.vue'

/* the working behind every number: how the budget is made, how suburbs are
   ranked, and where each dataset comes from with its date. people can't
   trust a ranking they can't check, and caseworkers will want to. it also
   says what New Roots covers and how often each source is refreshed, so
   nobody takes it as the only word on where to live */

const { t } = useI18n()
const { fullDate } = useFormat()
</script>

<template>
  <div class="page page--narrow how">
    <h1>{{ t('howItWorks.title') }}</h1>
    <p class="lead">{{ t('howItWorks.lead') }}</p>

    <section id="budget" aria-labelledby="budget-heading" tabindex="-1">
      <h2 id="budget-heading">{{ t('howItWorks.budgetHeading') }}</h2>
      <p>{{ t('howItWorks.budget1') }}</p>
      <p>{{ t('howItWorks.budget2') }}</p>
      <p>{{ t('howItWorks.budget3') }}</p>
    </section>

    <section id="ranking" aria-labelledby="ranking-heading">
      <h2 id="ranking-heading">{{ t('howItWorks.rankHeading') }}</h2>
      <ol class="how__steps">
        <li>{{ t('howItWorks.rank1') }}</li>
        <li>{{ t('howItWorks.rank2') }}</li>
        <li>{{ t('howItWorks.rank3') }}</li>
        <li>{{ t('howItWorks.rank4') }}</li>
      </ol>
    </section>

    <section id="coverage" aria-labelledby="coverage-heading">
      <h2 id="coverage-heading">{{ t('howItWorks.coverageHeading') }}</h2>
      <p>{{ t('howItWorks.coverage1') }}</p>
      <p>{{ t('howItWorks.coverage2') }}</p>
    </section>

    <section id="updates" aria-labelledby="updates-heading" tabindex="-1">
      <h2 id="updates-heading">{{ t('howItWorks.updatesHeading') }}</h2>
      <p class="how__updated">{{ t('howItWorks.updated', { date: fullDate(DATA_UPDATED) }) }}</p>
      <ul class="how__schedule">
        <li>{{ t('howItWorks.schedule.rents') }}</li>
        <li>{{ t('howItWorks.schedule.payments') }}</li>
        <li>{{ t('howItWorks.schedule.census') }}</li>
        <li>{{ t('howItWorks.schedule.places') }}</li>
      </ul>
      <div class="panel how__disclaimer">
        <h3>{{ t('howItWorks.disclaimerHeading') }}</h3>
        <p>{{ t('howItWorks.disclaimer1') }}</p>
        <p>{{ t('howItWorks.disclaimer2') }}</p>
      </div>
    </section>

    <section id="data" aria-labelledby="data-heading">
      <h2 id="data-heading">{{ t('howItWorks.dataHeading') }}</h2>
      <p>{{ t('howItWorks.dataLead') }}</p>
      <ul class="how__datasets">
        <li v-for="dataset in DATASETS" :key="dataset.id" class="panel">
          <h3>
            <ExternalLink v-if="dataset.url" :href="dataset.url">{{ dataset.name }}</ExternalLink>
            <template v-else>{{ dataset.name }}</template>
          </h3>
          <p>{{ t(dataset.useKey) }}</p>
          <p class="how__meta">
            {{ t('howItWorks.publisher', { publisher: dataset.publisher }) }} · {{ dataset.period }}
          </p>
          <p class="how__meta">{{ t(`howItWorks.updates.${dataset.updates}`) }}</p>
          <p v-if="dataset.enteredByHand" class="how__meta">{{ t('howItWorks.byHand') }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.how section {
  margin-top: 2rem;
}

.how section:focus {
  outline: none;
}

.how__updated {
  font-weight: 700;
}

.how__schedule {
  padding-inline-start: 1.25rem;
}

.how__schedule li {
  margin-bottom: 0.4rem;
}

.how__disclaimer {
  margin-top: 1rem;
}

.how__steps {
  padding-inline-start: 1.25rem;
}

.how__steps li {
  margin-bottom: 0.6rem;
}

.how__datasets {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.how__datasets h3 {
  margin-bottom: 0.35rem;
}

.how__datasets p {
  margin-bottom: 0.25rem;
}

.how__meta {
  color: var(--nr-ink-muted);
  font-size: 0.9375rem;
}
</style>
