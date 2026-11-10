<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DATASETS } from '@/data/datasets'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import SampleBadge from '@/components/ui/SampleBadge.vue'

/* the working behind every number: how the budget is made, how suburbs are
   ranked, and where each dataset comes from with its date. people can't
   trust a ranking they can't check, and caseworkers will want to */

const { t } = useI18n()
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
      <p class="how__sample">
        <SampleBadge />
        <span>{{ t('howItWorks.budgetSample') }}</span>
      </p>
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

    <section id="data" aria-labelledby="data-heading">
      <h2 id="data-heading">{{ t('howItWorks.dataHeading') }}</h2>
      <p>{{ t('howItWorks.dataLead') }}</p>
      <ul class="how__datasets">
        <li v-for="dataset in DATASETS" :key="dataset.id" class="panel">
          <h3>
            <ExternalLink :href="dataset.url">{{ dataset.name }}</ExternalLink>
          </h3>
          <p>{{ t(dataset.useKey) }}</p>
          <p class="how__meta">
            {{ t('howItWorks.publisher', { publisher: dataset.publisher }) }} · {{ dataset.period }}
          </p>
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

.how__sample {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
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
