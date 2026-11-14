<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, List, Map as MapIcon, Printer } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useResults } from '@/composables/useResults'
import { useFormat } from '@/composables/useFormat'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import { TOPICS } from '@/data/topics'
import SuburbCard from '@/components/results/SuburbCard.vue'
import NothingFits from '@/components/results/NothingFits.vue'
import ResultsGate from '@/components/results/ResultsGate.vue'
import ExampleNotice from '@/components/results/ExampleNotice.vue'
import ClearDetailsButton from '@/components/layout/ClearDetailsButton.vue'

/* the shortlist. on a phone, List and Map are tabs, the same as the
   wireframe. on a wide screen the map runs across the top with its panel,
   like the data team's map, and the list sits underneath in two columns.
   the list is never less than the map: every suburb on the map is reachable
   from here too */

// only people who open the map download Leaflet
const SuburbMap = defineAsyncComponent(() => import('@/components/results/SuburbMap.vue'))

const PAGE_SIZE = 6

const { t } = useI18n()
const answers = useAnswersStore()
const { status, errorKind, data, derived, nothingFits, counted, retry } = useResults()
const { money, home } = useFormat()
const wide = useMediaQuery('(min-width: 64rem)')
const { rentHome } = useSuburbFacts()

const tab = ref<'list' | 'map'>('list')
const shown = ref(PAGE_SIZE)
const selected = ref<string | null>(null)
const tabs = ref<HTMLButtonElement[]>([])

const ranked = computed(() => derived.value?.ranked ?? [])
const visible = computed(() => ranked.value.slice(0, shown.value))
const budget = computed(() => answers.budget?.weekly ?? 0)

const summaryLine = computed(() =>
  t('results.summaryLine', {
    people: t('units.people', answers.people),
    home: home(answers.home.asked),
    budget: money(budget.value),
  }),
)

// US 2.1, say so when the figures describe a different home from the one asked for
const homeNote = computed(() =>
  answers.home.note === 'none' ? null : t(`homes.notes.${answers.home.note}`),
)

// US 2.2, the results list the priorities they were ranked on
const used = computed(() =>
  TOPICS.filter((topic) => counted.value.has(topic.id)).map((topic) => ({
    id: topic.id,
    icon: topic.icon,
    label:
      topic.id === 'Affordability'
        ? `${t(`topics.${topic.key}`)}: ${t('results.alwaysCounts')}`
        : t('results.topicLevel', {
            topic: t(`topics.${topic.key}`),
            level: t(`importance.${answers.importance[topic.id]}`),
          }),
  })),
)

// the map opens on the top suburb
watch(
  ranked,
  (list) => {
    if (!selected.value && list[0]) selected.value = list[0].id
  },
  { immediate: true },
)

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
    v-if="status === 'ready' && nothingFits && derived"
    :closest="derived.closest"
    :budget="budget"
    :home="rentHome"
  />

  <div v-else class="page results">
    <ExampleNotice />
    <div class="results__head">
      <h1>{{ t('results.title') }}</h1>
      <RouterLink :to="{ name: 'household' }" class="link-action">{{
        t('results.edit')
      }}</RouterLink>
    </div>
    <p class="results__line">{{ summaryLine }}</p>
    <p v-if="homeNote" class="results__note">
      <Info :size="20" aria-hidden="true" />
      <span>{{ homeNote }}</span>
    </p>
    <div v-if="wide" class="results__used">
      <p id="ranked-using" class="results__used-label">{{ t('results.rankedUsing') }}</p>
      <ul class="results__chips" aria-labelledby="ranked-using">
        <li v-for="item in used" :key="item.id">
          <component :is="item.icon" :size="18" aria-hidden="true" />
          {{ item.label }}
        </li>
      </ul>
    </div>
    <details v-else class="results__used results__used--folded">
      <summary class="results__used-label">
        {{ t('results.rankedUsingCount', { n: used.length }) }}
      </summary>
      <ul class="results__chips">
        <li v-for="item in used" :key="item.id">
          <component :is="item.icon" :size="18" aria-hidden="true" />
          {{ item.label }}
        </li>
      </ul>
    </details>

    <ResultsGate :status="status" :error-kind="errorKind" @retry="retry">
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

      <div v-if="derived && data" class="results__panels">
        <section
          v-if="wide || tab === 'map'"
          id="panel-map"
          :role="wide ? undefined : 'tabpanel'"
          :aria-labelledby="wide ? undefined : 'tab-map'"
          :aria-label="wide ? t('results.map') : undefined"
          class="results__map"
        >
          <SuburbMap
            v-model:selected="selected"
            :suburbs="derived.all"
            :counted="counted"
            :has-language="answers.censusLanguage !== null"
            :total="ranked.length"
            :side="wide"
          />
        </section>

        <section
          v-show="wide || tab === 'list'"
          id="panel-list"
          :role="wide ? undefined : 'tabpanel'"
          :aria-labelledby="wide ? undefined : 'tab-list'"
          :aria-label="wide ? t('results.list') : undefined"
          class="results__list"
        >
          <ol id="results-list" class="results__cards">
            <li v-for="item in visible" :key="item.id">
              <SuburbCard :item="item" :data="data" :in-summary="answers.isShortlisted(item.id)" />
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
    </ResultsGate>
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

.results__note {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  max-width: 48rem;
}

.results__note svg {
  flex: none;
  margin-top: 0.15rem;
  color: var(--nr-rust);
}

.results__used {
  margin-bottom: 1.5rem;
}

.results__used-label {
  margin: 0 0 0.4rem;
  font-weight: 700;
}

.results__used--folded summary {
  display: flex;
  align-items: center;
  min-height: var(--nr-target);
  color: var(--nr-wine);
  cursor: pointer;
}

.results__used--folded[open] summary {
  margin-bottom: 0.25rem;
}

.results__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.results__chips li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-apricot);
  font-size: 0.9375rem;
}

.results__chips svg {
  color: var(--nr-rust);
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

.results__cards {
  display: grid;
  gap: 1rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

/* cards in a row stretch to the tallest one */
.results__cards > li {
  display: flex;
  flex-direction: column;
}

.results__panels {
  display: grid;
  gap: 2rem;
}

/* two cards to a row under the map on a wide screen */
@media (min-width: 64rem) {
  .results__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
