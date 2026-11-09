<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Languages, Siren } from '@lucide/vue'
import {
  CATEGORIES,
  SUPPORT_CHECKED,
  SUPPORT_SERVICES,
  type ServiceCategory,
} from '@/data/support-services'
import ServiceCard from '@/components/support/ServiceCard.vue'

/* the one-stop directory (US-22). emergency and interpreter help sit above
   everything, then one category at a time. the seeking asylum filter hides
   services that need permanent residency, so Reza isn't sent somewhere that
   will turn him away. the count is a live region, so filtering is announced */

const { t } = useI18n()
const category = ref<ServiceCategory | 'all'>('all')
const asylumOnly = ref(false)

const services = computed(() =>
  SUPPORT_SERVICES.filter(
    (service) =>
      (category.value === 'all' || service.categories.includes(category.value)) &&
      !(asylumOnly.value && service.visaNote === 'permanentOnly'),
  ),
)

const filters = computed(() => [
  { value: 'all' as const, label: t('support.all') },
  ...CATEGORIES.map((value) => ({ value, label: t(`support.categories.${value}`) })),
])
</script>

<template>
  <div class="page page--narrow support">
    <h1>{{ t('support.title') }}</h1>
    <p class="lead">{{ t('support.lead') }}</p>

    <div class="support__alert support__alert--urgent">
      <Siren :size="24" aria-hidden="true" />
      <p>{{ t('support.emergency') }}</p>
      <a href="tel:000" class="btn btn--primary">{{ t('support.call', { phone: '000' }) }}</a>
    </div>

    <div class="support__alert">
      <Languages :size="24" aria-hidden="true" />
      <p>{{ t('support.interpreter') }}</p>
      <a href="tel:131450" class="btn btn--outline">{{
        t('support.call', { phone: '131 450' })
      }}</a>
    </div>

    <div class="support__filters" role="group" aria-labelledby="support-filter-label">
      <p id="support-filter-label" class="legend-heading">{{ t('support.filterLabel') }}</p>
      <div class="support__chips">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="support__chip"
          :aria-pressed="category === filter.value ? 'true' : 'false'"
          @click="category = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
      <button
        type="button"
        class="support__chip support__chip--toggle"
        :aria-pressed="asylumOnly ? 'true' : 'false'"
        @click="asylumOnly = !asylumOnly"
      >
        {{ t('support.asylumOnly') }}
      </button>
    </div>

    <p class="support__count" aria-live="polite">
      {{ t('support.count', { n: services.length }, services.length) }}
    </p>

    <ul class="support__list">
      <li v-for="service in services" :key="service.id">
        <ServiceCard :service="service" />
      </li>
    </ul>

    <p class="muted">{{ t('support.checked', { date: SUPPORT_CHECKED }) }}</p>
    <p class="muted">{{ t('support.notPartOf') }}</p>
  </div>
</template>

<style scoped>
.support__alert {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--nr-radius);
  background: var(--nr-panel);
}

.support__alert svg {
  margin-top: 0.1rem;
  color: var(--nr-wine);
}

.support__alert p {
  margin: 0;
  font-weight: 600;
}

.support__alert .btn {
  grid-column: 1 / -1;
}

.support__alert--urgent {
  border: 3px solid var(--nr-wine);
  background: var(--nr-surface-raised);
}

.support__filters {
  margin-top: 1.75rem;
}

.support__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.support__chip {
  min-height: var(--nr-target);
  padding: 0.5rem 1.1rem;
  border: 2px solid var(--nr-wine);
  border-radius: var(--nr-radius-pill);
  background: transparent;
  color: var(--nr-wine);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.support__chip:hover {
  background: var(--nr-apricot);
}

.support__chip[aria-pressed='true'] {
  background: var(--nr-wine);
  color: var(--nr-cream);
}

/* the tick says "on" in a way that doesn't rely on the fill colour */
.support__chip[aria-pressed='true']::before {
  content: '\2713\00a0';
}

.support__count {
  margin-top: 1.25rem;
  font-weight: 700;
}

.support__list {
  display: grid;
  gap: 1rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}

@media (min-width: 40rem) {
  .support__alert {
    grid-template-columns: auto 1fr auto;
    align-items: center;
  }

  .support__alert .btn {
    grid-column: auto;
  }
}
</style>
