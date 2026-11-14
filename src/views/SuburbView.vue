<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { Check, ChevronLeft, Plus, TrendingDown, TrendingUp } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useResults } from '@/composables/useResults'
import { useFormat } from '@/composables/useFormat'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import { insights, languageShare, metricValue, topLanguages } from '@/services/results'
import { useLanguageName } from '@/composables/useLanguageName'
import { SCHOOL_NEARBY_KM } from '@/data/metrics'
import BudgetBadge from '@/components/ui/BudgetBadge.vue'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import TopicBars from '@/components/results/TopicBars.vue'
import ResultsGate from '@/components/results/ResultsGate.vue'

/* why a suburb ranks where it does: a score for each of the seven topics,
   what it does best and worst on, then the figures behind it with their
   sources and dates. reported crime only shows when the person chose to
   count it, so the page never leads with a crime rate nobody asked for */

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const answers = useAnswersStore()
const { status, errorKind, data, derived, counted, retry } = useResults()
const { money, km, percent, decimal, home } = useFormat()
const announcement = ref('')
const { rentHome } = useSuburbFacts()

const item = computed(() => derived.value?.byId.get(props.id))
const total = computed(() => derived.value?.ranked.length ?? 0)
const saved = computed(() => (item.value ? answers.isShortlisted(item.value.id) : false))

const findings = computed(() =>
  item.value && data.value
    ? insights(data.value, item.value, counted.value, answers.home.rentMetric)
    : null,
)

const languageName = useLanguageName()
const language = computed(() => {
  const census = answers.censusLanguage
  if (!census || !languageName.value || !item.value || !data.value) return null
  return { name: languageName.value, share: languageShare(data.value, item.value.id, census) }
})

const spoken = computed(() =>
  item.value && data.value ? topLanguages(data.value, item.value.id) : [],
)

// US 4.1, the school types this household needs, with a plain "none nearby"
const schools = computed(() => {
  if (!item.value) return []
  const levels =
    answers.schoolNeed === 'both'
      ? (['primary', 'secondary'] as const)
      : answers.schoolNeed === 'none'
        ? []
        : [answers.schoolNeed]
  return levels.map((level) => {
    const distance = metricValue(item.value!.obt, `${level}_school_proximity`)
    const near = distance !== null && distance <= SCHOOL_NEARBY_KM
    const key = level === 'primary' ? 'Primary' : 'Secondary'
    return near
      ? t(`suburb.school${key}`, { distance: km(distance) })
      : t(`suburb.no${key}`, { distance: km(SCHOOL_NEARBY_KM) })
  })
})

const value = (metric: string) => metricValue(item.value?.obt ?? null, metric)

// the router sets a generic title, this swaps in the suburb's name
watchEffect(() => {
  if (item.value) document.title = `${item.value.name} | ${t('app.name')}`
})

function toggleSummary() {
  const entry = item.value
  if (!entry) return
  if (!answers.toggleShortlist(entry.id)) {
    announcement.value = t('suburb.full')
    return
  }
  announcement.value = t(saved.value ? 'suburb.added' : 'suburb.removed', { suburb: entry.name })
}
</script>

<template>
  <div class="page page--narrow suburb">
    <RouterLink :to="{ name: 'results' }" class="link-action suburb__back">
      <ChevronLeft class="flip-rtl" :size="20" aria-hidden="true" />
      {{ t('suburb.back') }}
    </RouterLink>

    <ResultsGate :status="status" :error-kind="errorKind" @retry="retry">
      <template v-if="item && data">
        <h1>{{ item.name }}</h1>
        <p class="suburb__meta">
          <span>
            {{ item.rank ? t('suburb.ranked', { rank: item.rank, total }) : t('suburb.notRanked') }}
          </span>
          <BudgetBadge :status="item.status" />
        </p>
        <p v-if="item.match !== null" class="suburb__match">
          {{ t('suburb.match', { score: item.match }) }}
        </p>

        <section aria-labelledby="why-heading">
          <h2 id="why-heading">{{ t('suburb.why') }}</h2>
          <TopicBars
            :suburb="item"
            :counted="counted"
            :has-language="answers.censusLanguage !== null"
          />
        </section>

        <div
          v-if="findings && (findings.best.length || findings.worst.length)"
          class="suburb__findings"
        >
          <section
            v-if="findings.best.length"
            class="suburb__finding"
            aria-labelledby="best-heading"
          >
            <h2 id="best-heading">
              <TrendingUp :size="22" aria-hidden="true" />
              {{ t('suburb.doesWell') }}
            </h2>
            <ul>
              <li v-for="finding in findings.best" :key="finding.metric">
                <span>{{ t(`metrics.${finding.metric}`) }}</span>
                <span class="suburb__rank">
                  {{ t('suburb.rankOf', { rank: finding.rank, total: finding.total }) }}
                </span>
              </li>
            </ul>
          </section>
          <section
            v-if="findings.worst.length"
            class="suburb__finding suburb__finding--behind"
            aria-labelledby="behind-heading"
          >
            <h2 id="behind-heading">
              <TrendingDown :size="22" aria-hidden="true" />
              {{ t('suburb.fallsBehind') }}
            </h2>
            <ul>
              <li v-for="finding in findings.worst" :key="finding.metric">
                <span>{{ t(`metrics.${finding.metric}`) }}</span>
                <span class="suburb__rank">
                  {{ t('suburb.rankOf', { rank: finding.rank, total: finding.total }) }}
                </span>
              </li>
            </ul>
          </section>
          <p class="muted suburb__rank-hint">{{ t('suburb.rankHint') }}</p>
        </div>

        <section aria-labelledby="data-heading">
          <h2 id="data-heading">{{ t('suburb.dataBehind') }}</h2>
          <ul class="suburb__facts">
            <li>
              <template v-if="item.rent !== null">
                {{ t('suburb.rent', { home: home(rentHome), amount: money(item.rent) }) }}
              </template>
              <template v-else>{{ t('suburb.rentMissing', { suburb: item.name }) }}</template>
              <span class="suburb__source">{{ t('suburb.rentSource') }}</span>
            </li>
            <li v-if="language">
              {{
                language.share === null
                  ? t('suburb.fewSpeakers', { language: language.name })
                  : t('suburb.speakers', {
                      language: language.name,
                      percent: percent(language.share),
                    })
              }}
              <span class="suburb__source">{{ t('suburb.censusSource') }}</span>
            </li>
            <li v-if="schools.length">
              <span v-for="line in schools" :key="line" class="suburb__line">{{ line }}</span>
              <span class="suburb__source">{{ t('suburb.schoolsSource') }}</span>
              <I18nT keypath="suburb.zones" tag="span" scope="global" class="suburb__note">
                <template #findMySchool>
                  <ExternalLink href="https://www.findmyschool.vic.gov.au"
                    >Find My School</ExternalLink
                  >
                </template>
              </I18nT>
            </li>
            <li v-if="value('english_class_proximity') !== null">
              {{ t('suburb.englishClass', { distance: km(value('english_class_proximity')!) }) }}
              <span class="suburb__source">{{ t('suburb.englishSource') }}</span>
            </li>
            <li v-if="value('gp_proximity') !== null || value('hospital_proximity') !== null">
              <span v-if="value('gp_proximity') !== null" class="suburb__line">
                {{ t('suburb.gp', { distance: km(value('gp_proximity')!) }) }}
              </span>
              <span v-if="value('hospital_proximity') !== null" class="suburb__line">
                {{ t('suburb.hospital', { distance: km(value('hospital_proximity')!) }) }}
              </span>
              <span class="suburb__source">{{ t('suburb.healthSource') }}</span>
            </li>
            <li
              v-if="
                value('train_station_proximity') !== null || value('bus_tram_stop_density') !== null
              "
            >
              <span v-if="value('train_station_proximity') !== null" class="suburb__line">
                {{ t('suburb.train', { distance: km(value('train_station_proximity')!) }) }}
              </span>
              <span v-if="value('bus_tram_stop_density') !== null" class="suburb__line">
                {{ t('suburb.stops', { n: decimal(value('bus_tram_stop_density')!) }) }}
              </span>
              <span class="suburb__source">{{ t('suburb.transportSource') }}</span>
            </li>
            <li v-if="counted.has('Safety') && value('crime_per_1000') !== null">
              {{ t('suburb.crimeRate', { rate: decimal(value('crime_per_1000')!) }) }}
              <span class="suburb__source">{{ t('suburb.crimeSource') }}</span>
            </li>
          </ul>

          <h3 class="suburb__subhead">{{ t('suburb.languagesHeading') }}</h3>
          <ul v-if="spoken.length" class="suburb__languages">
            <li v-for="row in spoken" :key="row.language">
              <span>{{ row.label }}</span>
              <span>{{ percent(row.percent) }}</span>
            </li>
          </ul>
          <p v-else class="muted">{{ t('suburb.noLanguages') }}</p>
          <p class="suburb__source">{{ t('suburb.censusSource') }}</p>

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
        <p class="suburb__announce" role="status">{{ announcement }}</p>
      </template>

      <template v-else>
        <h1>{{ t('suburb.title') }}</h1>
        <p>{{ t('suburb.notFound') }}</p>
      </template>
    </ResultsGate>
  </div>
</template>

<style scoped>
.suburb__back {
  margin-inline-start: -0.75rem;
  margin-bottom: 0.5rem;
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

.suburb__findings {
  display: grid;
  gap: 0 1.5rem;
}

.suburb__finding {
  padding: 1rem 1.25rem 0.5rem;
  border-inline-start: 5px solid var(--nr-wine);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-panel);
}

.suburb__finding--behind {
  border-inline-start-color: var(--nr-orange);
}

.suburb__finding h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0;
  font-size: 1.25rem;
}

.suburb__finding ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.suburb__finding li,
.suburb__languages li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  padding-block: 0.45rem;
  border-top: 1px solid var(--nr-line);
}

.suburb__rank {
  color: var(--nr-rust);
  font-weight: 700;
}

.suburb__rank-hint {
  margin-top: 0.5rem;
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

.suburb__line {
  display: block;
}

.suburb__source {
  display: block;
  color: var(--nr-rust);
  font-size: 0.9375rem;
}

.suburb__note {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.9375rem;
}

.suburb__subhead {
  margin: 1.25rem 0 0.25rem;
  font-size: 1.125rem;
}

.suburb__languages {
  margin: 0 0 0.25rem;
  padding: 0;
  list-style: none;
}

.suburb__announce {
  margin: 0.75rem 0 0;
  font-weight: 700;
}

.suburb__announce:empty {
  display: none;
}

.suburb .btn--block {
  margin-top: 1.5rem;
}

@media (min-width: 40rem) {
  .suburb__findings {
    grid-template-columns: 1fr 1fr;
  }

  .suburb__rank-hint {
    grid-column: 1 / -1;
  }
}
</style>
