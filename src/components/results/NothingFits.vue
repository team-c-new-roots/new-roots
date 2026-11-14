<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ChevronRight, Printer } from '@lucide/vue'
import { useFormat } from '@/composables/useFormat'
import type { HomeLabel } from '@/types'
import type { SuburbResult } from '@/services/results'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import ClearDetailsButton from '@/components/layout/ClearDetailsButton.vue'

/* when no suburb's median rent fits, say so plainly and show how far over the
   closest ones are, rather than an empty list. then point at the help that
   sits outside the rent data, like rooms in share houses. it keeps the same
   Print summary and Clear my details bar as the results list, since it's the
   same screen with nothing to rank */

defineProps<{
  closest: SuburbResult[]
  budget: number
  // the home the rent figures describe
  home: HomeLabel
}>()

const { t } = useI18n()
const { money, home: homeName } = useFormat()
</script>

<template>
  <div class="page page--narrow nothing-fits">
    <h1>{{ t('nothingFits.title') }}</h1>
    <p class="lead">
      {{ t('nothingFits.lead', { home: homeName(home), budget: money(budget) }) }}
    </p>

    <h2>{{ t('nothingFits.closest') }}</h2>
    <ul class="nothing-fits__list">
      <li v-for="item in closest" :key="item.id" class="nothing-fits__item">
        <div>
          <RouterLink :to="{ name: 'suburb', params: { id: item.id } }" class="nothing-fits__name">
            {{ item.name }}
          </RouterLink>
          <p v-if="item.rent !== null" class="nothing-fits__median">
            {{ t('nothingFits.median', { home: homeName(home), amount: money(item.rent) }) }}
          </p>
        </div>
        <span v-if="item.overBy !== null" class="badge badge--above">
          {{ t('status.overBy', { amount: money(item.overBy) }) }}
        </span>
      </li>
    </ul>

    <h2>{{ t('nothingFits.otherWays') }}</h2>
    <p>{{ t('nothingFits.shareHouses') }}</p>
    <ul class="nothing-fits__links">
      <li>
        <ExternalLink href="https://asrc.org.au">{{ t('nothingFits.asrc') }}</ExternalLink>
      </li>
      <li>
        <RouterLink :to="{ name: 'support' }">
          {{ t('nothingFits.allSupport') }}
          <ChevronRight class="flip-rtl" :size="18" aria-hidden="true" />
        </RouterLink>
      </li>
      <li>
        <RouterLink :to="{ name: 'household' }">
          {{ t('nothingFits.change') }}
          <ChevronRight class="flip-rtl" :size="18" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>

    <div class="action-bar">
      <RouterLink :to="{ name: 'summary' }" class="btn btn--accent">
        <Printer :size="20" aria-hidden="true" />
        {{ t('results.print') }}
      </RouterLink>
      <ClearDetailsButton />
    </div>
  </div>
</template>

<style scoped>
.nothing-fits h2 {
  margin-top: 1.75rem;
}

.nothing-fits__list,
.nothing-fits__links {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.nothing-fits__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-radius: var(--nr-radius);
  background: var(--nr-panel);
}

.nothing-fits__name {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  color: var(--nr-wine);
  font-size: 1.25rem;
  font-weight: 700;
}

.nothing-fits__median {
  margin: 0;
}

.nothing-fits__links a {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--nr-target);
}
</style>
