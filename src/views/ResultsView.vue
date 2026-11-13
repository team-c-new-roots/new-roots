<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { List, Map as MapIcon, Printer } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useResults } from '@/composables/useResults'
import { useFormat } from '@/composables/useFormat'
import { useMediaQuery } from '@/composables/useMediaQuery'
import SuburbCard from '@/components/results/SuburbCard.vue'
import NothingFits from '@/components/results/NothingFits.vue'
import SampleBadge from '@/components/ui/SampleBadge.vue'
import ClearDetailsButton from '@/components/layout/ClearDetailsButton.vue'
import { MAP_URL } from '@/services/mapEmbed'

/* the shortlist. on a phone, List and Map are tabs, the same as the
   wireframe. on a wide screen there's room for both, so the tabs go, the map
   runs across the top and the list sits underneath. the list is never less
   than the map: every suburb on the map is reachable from here too */

// lazy load the map
const HtmlMap = defineAsyncComponent(() => import('@/components/results/HtmlMap.vue'))

const PAGE_SIZE = 5

const { t } = useI18n()
const answers = useAnswersStore()
const { result, nothingFits } = useResults()
const { money, home } = useFormat()
const wide = useMediaQuery('(min-width: 64rem)')

const tab = ref<'list' | 'map'>('list')
const shown = ref(PAGE_SIZE)
const selected = ref<string | null>(null)
const tabs = ref<HTMLButtonElement[]>([])

const ranked = computed(() => result.value?.ranked ?? [])
const visible = computed(() => ranked.value.slice(0, shown.value))
const budget = computed(() => answers.budget?.weekly ?? 0)

const summaryLine = computed(() =>
  t('results.summaryLine', {
    people: t('units.people', answers.people),
    home: home({ type: answers.homeType, bedrooms: answers.bedrooms }),
    budget: money(budget.value),
  }),
)

// the map opens on the top suburb
if (ranked.value[0]) selected.value = ranked.value[0].suburb.id

// arrow keys move between the two tabs, the way the ARIA tabs pattern expects
async function onTabKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  tab.value = tab.value === 'list' ? 'map' : 'list'
  await nextTick()
  tabs.value[tab.value === 'list' ? 0 : 1]?.focus()
}

async function showMore() {
  const firstNew = shown.value
  shown.value += PAGE_SIZE
  await nextTick()
  // move focus to the first new suburb so a keyboard user carries on from there
  document.querySelector<HTMLElement>(`#results-list > li:nth-child(${firstNew + 1}) a`)?.focus()
}
</script>

<template>
  <NothingFits
    v-if="nothingFits && result"
    :closest="result.closest"
    :budget="budget"
    :bedrooms="answers.bedrooms"
    :home-type="answers.homeType"
  />

  <div v-else-if="result" class="page results">
    <div class="results__head">
      <h1>{{ t('results.title') }}</h1>
      <RouterLink :to="{ name: 'household' }" class="link-action">{{
        t('results.edit')
      }}</RouterLink>
    </div>
    <p class="results__line">{{ summaryLine }}</p>

    <div
      v-if="!wide"
      class="results__tabs"
      role="tablist"
      :aria-label="t('results.viewsLabel')"
      @keydown="onTabKey"
    >
      <button
        id="tab-list"
        ref="tabs"
        type="button"
        role="tab"
        aria-controls="panel-list"
        :aria-selected="tab === 'list' ? 'true' : 'false'"
        :tabindex="tab === 'list' ? 0 : -1"
        @click="tab = 'list'"
      >
        <List :size="20" aria-hidden="true" />
        {{ t('results.list') }}
      </button>
      <button
        id="tab-map"
        ref="tabs"
        type="button"
        role="tab"
        aria-controls="panel-map"
        :aria-selected="tab === 'map' ? 'true' : 'false'"
        :tabindex="tab === 'map' ? 0 : -1"
        @click="tab = 'map'"
      >
        <MapIcon :size="20" aria-hidden="true" />
        {{ t('results.map') }}
      </button>
    </div>

    <div class="results__panels" :class="{ 'results__panels--wide': wide }">
      <section
        v-if="wide || tab === 'map'"
        id="panel-map"
        :role="wide ? undefined : 'tabpanel'"
        :aria-labelledby="wide ? undefined : 'tab-map'"
        :aria-label="wide ? t('results.map') : undefined"
        class="results__map"
      >
        <HtmlMap :src="MAP_URL" />
      </section>

      <section
        v-show="wide || tab === 'list'"
        id="panel-list"
        :role="wide ? undefined : 'tabpanel'"
        :aria-labelledby="wide ? undefined : 'tab-list'"
        :aria-label="wide ? t('results.list') : undefined"
        class="results__list"
      >
        <div class="results__sample"><SampleBadge /></div>
        <ol id="results-list" class="results__cards">
          <li v-for="item in visible" :key="item.suburb.id">
            <SuburbCard
              :item="item"
              :language="answers.rankingLanguage"
              :in-summary="answers.isShortlisted(item.suburb.id)"
            />
          </li>
        </ol>
        <p class="muted" aria-live="polite">
          {{ t('results.showing', { shown: visible.length, total: ranked.length }) }}
        </p>
        <button
          v-if="visible.length < ranked.length"
          type="button"
          class="btn btn--outline"
          @click="showMore"
        >
          {{ t('results.showMore') }}
        </button>
      </section>
    </div>

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
.results__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0 1rem;
}

.results__line {
  font-size: 1.0625rem;
}

.results__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 1.25rem;
  padding: 0.25rem;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-apricot);
}

.results__tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: var(--nr-target);
  border: 0;
  border-radius: var(--nr-radius-pill);
  background: transparent;
  color: var(--nr-ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.results__tabs button[aria-selected='true'] {
  background: var(--nr-wine);
  color: var(--nr-cream);
}

.results__sample {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.results__cards {
  display: grid;
  gap: 1rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

/* map on top, list below */
.results__panels--wide {
  display: grid;
  gap: 1.5rem;
  --html-map-height: clamp(28rem, 70vh, 44rem);
}

/* 2 cards per row */
.results__panels--wide .results__cards {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
</style>
