<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronLeft, Plus } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useResults } from '@/composables/useResults'
import { useFormat } from '@/composables/useFormat'
import type { RankedSuburb, Topic } from '@/types'
import BudgetBadge from '@/components/ui/BudgetBadge.vue'
import ScoreBar from '@/components/ui/ScoreBar.vue'
import SampleBadge from '@/components/ui/SampleBadge.vue'

/* why a suburb ranks where it does, with budget fit counted double, then the
   figures behind it, each with its source and date. reported crime only shows
   a figure when the person chose to count it, so the page never leads with a
   crime rate nobody asked for */

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const answers = useAnswersStore()
const { result } = useResults()
const { money, km, percent, home } = useFormat()
const status = ref('')

const item = computed<RankedSuburb | undefined>(() =>
  result.value?.all.find((entry) => entry.suburb.id === props.id),
)
const total = computed(() => result.value?.ranked.length ?? 0)
const language = computed(() => answers.rankingLanguage)
const share = computed(() =>
  item.value && language.value ? (item.value.suburb.languages?.[language.value] ?? null) : null,
)
const saved = computed(() => (item.value ? answers.isShortlisted(item.value.suburb.id) : false))

// the router sets a generic title, this swaps in the suburb's name
watchEffect(() => {
  if (item.value) document.title = `${item.value.suburb.name} | ${t('app.name')}`
})

// says why a topic isn't in the match, or nothing when it is
function noteFor(topic: Topic): string | undefined {
  const entry = item.value
  if (!entry) return undefined
  if (topic === 'community' && !language.value) return t('suburb.noLanguage')
  if (!entry.counted[topic]) return t('suburb.notCounted')
  if (entry.scores[topic] === null) return t('suburb.noData')
  return undefined
}

function toggleSummary() {
  const entry = item.value
  if (!entry) return
  answers.toggleShortlist(entry.suburb.id)
  status.value = t(saved.value ? 'suburb.added' : 'suburb.removed', { suburb: entry.suburb.name })
}
</script>

<template>
  <div class="page page--narrow suburb">
    <RouterLink :to="{ name: 'results' }" class="link-action suburb__back">
      <ChevronLeft class="flip-rtl" :size="20" aria-hidden="true" />
      {{ t('suburb.back') }}
    </RouterLink>

    <template v-if="item">
      <h1>{{ item.suburb.name }}</h1>
      <p class="muted suburb__council">{{ item.suburb.lga }}</p>
      <p class="suburb__meta">
        <span>
          {{ item.rank ? t('suburb.ranked', { rank: item.rank, total }) : t('suburb.notRanked') }}
        </span>
        <BudgetBadge :status="item.status" />
      </p>
      <p v-if="item.match !== null" class="suburb__match">
        {{ t('suburb.match', { score: item.match }) }}
      </p>
      <p v-else class="panel">{{ t('suburb.noRent', { suburb: item.suburb.name }) }}</p>

      <section aria-labelledby="why-heading">
        <h2 id="why-heading">{{ t('suburb.why') }}</h2>
        <dl class="suburb__scores">
          <ScoreBar
            :label="t('suburb.budgetFit')"
            :score="item.scores.budget"
            :note="item.scores.budget === null ? t('suburb.noData') : undefined"
          />
          <ScoreBar
            :label="t('suburb.community')"
            :score="item.scores.community"
            :note="noteFor('community')"
          />
          <ScoreBar
            :label="t('suburb.essentials')"
            :score="item.scores.essentials"
            :note="noteFor('essentials')"
          />
          <ScoreBar
            :label="t('suburb.crime')"
            :score="item.scores.crime"
            :note="noteFor('crime')"
          />
        </dl>
      </section>

      <section aria-labelledby="data-heading">
        <div class="suburb__data-head">
          <h2 id="data-heading">{{ t('suburb.dataBehind') }}</h2>
          <SampleBadge />
        </div>
        <ul class="suburb__facts">
          <li v-if="item.home && item.median !== null">
            {{ t('suburb.rent', { home: home(item.home), amount: money(item.median) }) }}
            <span class="suburb__source">{{ t('suburb.rentSource') }}</span>
          </li>
          <li v-if="language && share !== null">
            {{
              t('suburb.speakers', {
                language: t(`languages.${language}`),
                percent: percent(share),
              })
            }}
            <span class="suburb__source">{{ t('suburb.censusSource') }}</span>
          </li>
          <li v-if="item.suburb.schoolPrimaryKm !== null && item.suburb.schoolSecondaryKm !== null">
            {{
              t('suburb.schools', {
                primary: km(item.suburb.schoolPrimaryKm),
                secondary: km(item.suburb.schoolSecondaryKm),
              })
            }}
            <span class="suburb__source">{{ t('suburb.schoolsSource') }}</span>
          </li>
          <li v-if="item.suburb.englishClassKm !== null">
            {{ t('suburb.englishClass', { distance: km(item.suburb.englishClassKm) }) }}
            <span class="suburb__source">{{ t('suburb.englishSource') }}</span>
          </li>
          <li v-if="item.counted.crime && item.suburb.crimeRate !== null">
            {{ t('suburb.crimeRate', { rate: item.suburb.crimeRate }) }}
            <span class="suburb__source">{{ t('suburb.crimeSource') }}</span>
          </li>
        </ul>
        <p class="muted">{{ t('suburb.averages') }}</p>
      </section>

      <button
        type="button"
        class="btn btn--block"
        :class="saved ? 'btn--outline' : 'btn--primary'"
        @click="toggleSummary"
      >
        <Check v-if="saved" :size="20" :stroke-width="3" aria-hidden="true" />
        <Plus v-else :size="20" aria-hidden="true" />
        {{ saved ? t('suburb.remove') : t('suburb.add') }}
      </button>
      <p class="visually-hidden" role="status">{{ status }}</p>
    </template>

    <template v-else>
      <h1>{{ t('suburb.title') }}</h1>
      <p>{{ t('suburb.notFound') }}</p>
    </template>
  </div>
</template>

<style scoped>
.suburb__back {
  margin-inline-start: -0.75rem;
  margin-bottom: 0.5rem;
}

.suburb__council {
  margin-bottom: 0.25rem;
}

.suburb__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.25rem;
}

.suburb__match {
  font-size: 1.25rem;
  font-weight: 700;
}

.suburb section {
  margin-top: 1.75rem;
}

.suburb__scores {
  margin: 0;
}

.suburb__data-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.suburb__facts {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.suburb__facts li {
  padding-block: 0.5rem;
  font-size: 1.0625rem;
}

.suburb__source {
  display: block;
  color: var(--nr-rust);
  font-size: 0.9375rem;
}

.suburb .btn--block {
  margin-top: 1.5rem;
}
</style>
