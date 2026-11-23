<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ChevronRight, HandHeart, PencilLine, Users } from '@lucide/vue'
import { useFormat } from '@/composables/useFormat'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import type { HomeLabel } from '@/types'
import type { SuburbResult } from '@/services/results'
import ExternalLink from '@/components/ui/ExternalLink.vue'

/* when no suburb's median rent fits, lead with what they can do now, like a
   room in a share house, which isn't in the rent data. then the suburbs
   closest to the budget, with a jump straight to them. it sits at the top of
   the results page, and the full list and map follow, so nothing is hidden */

defineProps<{
  closest: SuburbResult[]
  budget: number
  // the home the rent figures describe
  home: HomeLabel
}>()

const { t } = useI18n()
const { money, home: homeName } = useFormat()
const { homeFor, estimateLine } = useSuburbFacts()
const closestHeading = ref<HTMLHeadingElement | null>(null)

// scroll and move focus, so keyboard and screen reader users land there too
function toClosest() {
  closestHeading.value?.scrollIntoView({ block: 'start' })
  closestHeading.value?.focus({ preventScroll: true })
}
</script>

<template>
  <section class="nothing-fits" aria-labelledby="now-heading">
    <p class="lead">
      {{ t('nothingFits.lead', { home: homeName(home), budget: money(budget) }) }}
    </p>
    <p>
      <a href="#closest-heading" class="nothing-fits__jump" @click.prevent="toClosest">
        {{ t('nothingFits.jump') }}
        <ArrowDown :size="18" aria-hidden="true" />
      </a>
    </p>

    <h2 id="now-heading">{{ t('nothingFits.now') }}</h2>
    <ul class="nothing-fits__actions">
      <li class="nothing-fits__action">
        <Users class="nothing-fits__icon" :size="26" aria-hidden="true" />
        <div>
          <h3>{{ t('nothingFits.shareTitle') }}</h3>
          <p>{{ t('nothingFits.shareHouses') }}</p>
          <RouterLink :to="{ name: 'support', query: { need: 'housing' } }">
            {{ t('nothingFits.shareLink') }}
            <ChevronRight class="flip-rtl" :size="18" aria-hidden="true" />
          </RouterLink>
        </div>
      </li>
      <li class="nothing-fits__action">
        <HandHeart class="nothing-fits__icon" :size="26" aria-hidden="true" />
        <div>
          <h3>{{ t('nothingFits.asrcTitle') }}</h3>
          <p>{{ t('nothingFits.asrcBody') }}</p>
          <ExternalLink href="https://asrc.org.au">{{ t('nothingFits.asrc') }}</ExternalLink>
        </div>
      </li>
      <li class="nothing-fits__action">
        <PencilLine class="nothing-fits__icon" :size="26" aria-hidden="true" />
        <div>
          <h3>{{ t('nothingFits.changeTitle') }}</h3>
          <p>{{ t('nothingFits.changeBody') }}</p>
          <RouterLink :to="{ name: 'household' }">
            {{ t('nothingFits.change') }}
            <ChevronRight class="flip-rtl" :size="18" aria-hidden="true" />
          </RouterLink>
        </div>
      </li>
    </ul>
    <p>
      <RouterLink :to="{ name: 'support' }" class="nothing-fits__more">
        {{ t('nothingFits.allSupport') }}
        <ChevronRight class="flip-rtl" :size="18" aria-hidden="true" />
      </RouterLink>
    </p>

    <h2 id="closest-heading" ref="closestHeading" tabindex="-1">
      {{ t('nothingFits.closest') }}
    </h2>
    <p>{{ t('nothingFits.closestLead') }}</p>
    <ul class="nothing-fits__list">
      <li v-for="item in closest" :key="item.id" class="nothing-fits__item">
        <div>
          <RouterLink :to="{ name: 'suburb', params: { id: item.id } }" class="nothing-fits__name">
            {{ item.name }}
          </RouterLink>
          <p v-if="item.rent !== null" class="nothing-fits__median">
            {{
              t('nothingFits.median', { home: homeName(homeFor(item)), amount: money(item.rent) })
            }}
            <small v-if="estimateLine(item)" class="nothing-fits__estimate">{{
              estimateLine(item)
            }}</small>
          </p>
        </div>
        <span v-if="item.overBy !== null" class="badge badge--above">
          {{ t('status.overBy', { amount: money(item.overBy) }) }}
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.nothing-fits {
  max-width: 48rem;
  margin-bottom: 1.5rem;
}

.nothing-fits h2 {
  margin-top: 1.75rem;
}

.nothing-fits__list,
.nothing-fits__actions {
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
  color: var(--nr-wine-text);
  font-size: 1.25rem;
  font-weight: 700;
}

.nothing-fits__estimate {
  display: block;
  font-size: 0.875rem;
}

.nothing-fits__median {
  margin: 0;
}

.nothing-fits__jump,
.nothing-fits__more,
.nothing-fits__action a {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--nr-target);
  font-weight: 700;
}

.nothing-fits__action {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  padding: 1rem 1.25rem;
  border: 2px solid var(--nr-line);
  border-radius: var(--nr-radius);
  background: var(--nr-surface-raised);
}

.nothing-fits__action h3 {
  margin: 0 0 0.25rem;
  font-size: 1.125rem;
}

.nothing-fits__action p {
  margin: 0 0 0.25rem;
}

.nothing-fits__icon {
  flex: none;
  margin-top: 0.1rem;
  color: var(--nr-rust);
}

#closest-heading {
  scroll-margin-top: 6rem;
}

#closest-heading:focus {
  outline: none;
}
</style>
