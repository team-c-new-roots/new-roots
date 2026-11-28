<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  Info,
  KeyRound,
  Plus,
  TrendingDown,
  TrendingUp,
} from '@lucide/vue'
import { SHORTLIST_MAX, useAnswersStore } from '@/stores/answers'
import { useResultsStore } from '@/stores/results'
import { useResults } from '@/composables/useResults'
import { useFormat } from '@/composables/useFormat'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import { useSummary } from '@/composables/useSummary'
import { insights, languageShare, metricValue, topLanguages } from '@/services/results'
import { useLanguageName } from '@/composables/useLanguageName'
import { SCHOOL_NEARBY_KM } from '@/data/metrics'
import { MOVE_IN } from '@/data/move-in'
import { moveInCost } from '@/services/moveIn'
import BudgetBadge from '@/components/ui/BudgetBadge.vue'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import TopicBars from '@/components/results/TopicBars.vue'
import ResultsGate from '@/components/results/ResultsGate.vue'
import DataNote from '@/components/results/DataNote.vue'
import RentTrend from '@/components/results/RentTrend.vue'
import NearbyServices from '@/components/suburb/NearbyServices.vue'
import TravelTimes from '@/components/suburb/TravelTimes.vue'
import CommunityPlaces from '@/components/suburb/CommunityPlaces.vue'
import RentalAvailability from '@/components/suburb/RentalAvailability.vue'
import SuburbContents from '@/components/suburb/SuburbContents.vue'

/* why a suburb ranks where it does: a score for each of the eight topics,
   what it does best and worst on, then the figures behind it with their
   sources and dates. the crime rate itself only shows when the person chose
   to count it, so the page never leads with a figure nobody asked for. when
   a small suburb has no rate, it says why */

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const answers = useAnswersStore()
const { status, errorKind, data, derived, counted, retry } = useResults()
const { money, km, percent, decimal, home } = useFormat()
const announcement = ref('')
// true when the last tap was refused, so the message shows as an error
const refused = ref(false)
const { homeFor, rentMetricFor, rentEstimate } = useSuburbFacts()

const item = computed(() => derived.value?.byId.get(props.id))
const total = computed(() => derived.value?.ranked.length ?? 0)
const summary = useSummary(derived)
const saved = computed(() => (item.value ? summary.has(item.value.id) : false))

const findings = computed(() =>
  item.value && data.value
    ? insights(data.value, item.value, counted.value, rentMetricFor(item.value))
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

// built on the median for their home, so it's hidden when there's no rent
const homeNote = computed(() =>
  answers.home.note === 'none' ? null : t(`homes.notes.${answers.home.note}`),
)

const moveIn = computed(() =>
  item.value && item.value.rent !== null ? moveInCost(item.value.rent) : null,
)

const value = (metric: string) => metricValue(item.value?.obt ?? null, metric)
const crimeRate = computed(() => value('crime_per_1000'))

// the router sets a generic title, this swaps in the suburb's name
watchEffect(() => {
  if (item.value) document.title = `${item.value.name} | ${t('app.name')}`
})

// the quick links at the top, in page order
const resultsStore = useResultsStore()
const contents = computed(() => [
  { id: 'why-heading', label: t('suburb.why') },
  { id: 'data-heading', label: t('suburb.dataBehind') },
  ...(moveIn.value ? [{ id: 'move-in-heading', label: t('moveIn.link') }] : []),
  { id: 'travel-heading', label: t('travel.title') },
  { id: 'nearby-heading', label: t('nearbyServices.title') },
  { id: 'community-heading', label: t('communityPlaces.title') },
  // only once its file has loaded, the section isn't there before that
  ...(resultsStore.availability
    ? [{ id: 'availability-heading', label: t('availability.title') }]
    : []),
  { id: 'rent-trend-heading', label: t('rentTrend.title') },
])

function toggleSummary() {
  const entry = item.value
  if (!entry) return
  refused.value = !summary.toggle(entry.id)
  if (refused.value) {
    announcement.value = t('suburb.full', { max: SHORTLIST_MAX })
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

        <SuburbContents :sections="contents" />

        <section class="suburb__part" aria-labelledby="why-heading">
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

        <section class="suburb__part" aria-labelledby="data-heading">
          <h2 id="data-heading">{{ t('suburb.dataBehind') }}</h2>
          <ul class="suburb__facts">
            <li>
              <template v-if="item.rent !== null">
                {{ t('suburb.rent', { home: home(homeFor(item)), amount: money(item.rent) }) }}
              </template>
              <template v-else>{{ t('suburb.rentMissing', { suburb: item.name }) }}</template>
              <span class="suburb__source">{{
                rentEstimate(item)
                  ? t(`suburb.rentEstimate.${rentEstimate(item)}`)
                  : t('suburb.rentSource')
              }}</span>
              <!-- US 2.1, the same note as the results when the figures are for a
                   different home, like 4 bedrooms for a family that needs 5 -->
              <span v-if="homeNote" class="suburb__note">{{ homeNote }}</span>
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
            <li v-if="counted.has('Safety')">
              <template v-if="crimeRate !== null">
                {{ t('suburb.crimeRate', { rate: decimal(crimeRate) }) }}
              </template>
              <template v-else>{{ t('suburb.crimeMissing', { suburb: item!.name }) }}</template>
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

          <!-- US 1.3, what they'll need to find before moving in -->
          <div v-if="moveIn" class="suburb__move-in" role="group" aria-labelledby="move-in-heading">
            <h3 id="move-in-heading" class="suburb__move-in-title">
              <KeyRound :size="22" aria-hidden="true" />
              {{
                t(moveIn.limited ? 'moveIn.title' : 'moveIn.titleOver', {
                  amount: money(moveIn.total),
                })
              }}
            </h3>
            <p>
              {{ t('moveIn.basis', { bond: money(moveIn.bond), advance: money(moveIn.advance) }) }}
            </p>
            <!-- weekly rent can only ask for 14 days in advance (CAV), so the
                 one month in the total is the most it could be -->
            <ul v-if="moveIn.limited" class="suburb__advance">
              <li>
                <strong>{{ t('moveIn.advanceMonthlyLabel') }}</strong>
                {{ t('moveIn.advanceMonthly') }}
              </li>
              <li>
                <strong>{{ t('moveIn.advanceWeeklyLabel') }}</strong>
                {{ t('moveIn.advanceWeekly') }}
              </li>
            </ul>
            <p v-else>
              {{ t('moveIn.over', { limit: money(MOVE_IN.weeklyLimit) }) }}
            </p>
            <details class="suburb__bond">
              <summary>
                <Info :size="20" aria-hidden="true" />
                <span>{{ t('moveIn.bondHelp') }}</span>
                <ChevronDown class="suburb__bond-chevron" :size="20" aria-hidden="true" />
              </summary>
              <div class="suburb__bond-body">
                <p>{{ t('moveIn.bondBody') }}</p>
                <p>{{ t('moveIn.bondLoanBody') }}</p>
                <p>
                  <ExternalLink :href="MOVE_IN.bondLoanUrl">{{
                    t('moveIn.bondLoan')
                  }}</ExternalLink>
                </p>
              </div>
            </details>
            <I18nT keypath="moveIn.limits" tag="p" scope="global" class="suburb__source">
              <template #limit>{{ money(MOVE_IN.weeklyLimit) }}</template>
              <template #cav>
                <ExternalLink :href="MOVE_IN.cavUrl">Consumer Affairs Victoria</ExternalLink>
              </template>
            </I18nT>
          </div>

          <p class="muted">{{ t('suburb.averages') }}</p>
          <DataNote compact />
        </section>

        <TravelTimes class="suburb__part" :item="item!" :data="data!" />
        <NearbyServices
          class="suburb__part"
          :obt="item!.obt"
          :suburb="item!.name"
          :all="data!.obt"
        />
        <CommunityPlaces class="suburb__part" :suburb-id="item!.id" :suburb="item!.name" />
        <RentalAvailability class="suburb__part" :item="item!" />

        <RentTrend
          class="suburb__part"
          :suburb-id="item!.id"
          :suburb-name="item!.name"
          :rent-metric="rentMetricFor(item!)"
          :home="home(homeFor(item!))"
        />

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
        <p class="suburb__count">
          {{ t('results.tracker', { count: summary.count.value, max: summary.max }) }}
          <RouterLink :to="{ name: 'summary' }">{{ t('results.seeSummary') }}</RouterLink>
        </p>
        <p class="suburb__announce" :class="{ field__error: refused }" role="status">
          <CircleAlert v-if="refused" :size="18" aria-hidden="true" />{{ announcement }}
        </p>
      </template>

      <template v-else>
        <h1>{{ t('suburb.title') }}</h1>
        <p>{{ t('suburb.notFound') }}</p>
      </template>
    </ResultsGate>
  </div>
</template>

<style scoped>
/* clear of the sticky header when a quick link scrolls to a heading */
.suburb :deep(h2[id]),
.suburb :deep(h3[id]) {
  scroll-margin-top: 6rem;
}

.suburb :deep(h2[id]:focus),
.suburb :deep(h3[id]:focus) {
  outline: none;
}

.suburb :deep(h2[id]:focus-visible),
.suburb :deep(h3[id]:focus-visible) {
  outline: 3px solid var(--nr-focus);
  outline-offset: 4px;
}

.suburb__back {
  margin-inline-start: -0.75rem;
  margin-bottom: 0.5rem;
}

.suburb__meta {
  /* white barely shows on the cream page, so the budget badge sits on apricot
     here, like the cards. dark and high contrast panels match their badges */
  --nr-tag-bg: var(--nr-panel);
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

/* each main part of the page gets room and a line above it, so one section's
   source line doesn't run into the next heading */
.suburb .suburb__part {
  margin-top: 2.75rem;
  padding-top: 2rem;
  border-top: 1px solid var(--nr-line);
}

.suburb__findings {
  display: grid;
  gap: 0 1.5rem;
}

.suburb__finding {
  padding: 1rem 1.25rem 0.5rem;
  border-inline-start: 5px solid var(--nr-wine-line);
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

/* boxed off from the figures above, since it's money they'll need on the day */
.suburb__move-in {
  margin: 1.5rem 0 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--nr-line);
  border-inline-start: 5px solid var(--nr-orange);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-panel);
}

.suburb__move-in p {
  margin: 0.25rem 0 0;
}

.suburb__advance {
  margin: 0.35rem 0 0;
  padding-inline-start: 1.25rem;
}

.suburb__move-in-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.25rem;
}

.suburb__move-in-title svg,
.suburb__bond summary svg {
  flex: none;
  color: var(--nr-rust);
}

.suburb__bond {
  margin-top: 0.35rem;
}

.suburb__bond summary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--nr-target);
  color: var(--nr-wine-text);
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}

.suburb__bond summary::-webkit-details-marker {
  display: none;
}

.suburb__bond summary span {
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.suburb__bond-chevron {
  transition: transform 0.15s ease;
}

.suburb__bond[open] .suburb__bond-chevron {
  transform: rotate(180deg);
}

.suburb__bond-body {
  padding: 0.25rem 0 0.5rem;
}

.suburb__bond-body p:first-child {
  margin-top: 0;
}

.suburb__move-in .suburb__source {
  margin-top: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .suburb__bond-chevron {
    transition: none;
  }
}

.suburb__languages {
  margin: 0 0 0.25rem;
  padding: 0;
  list-style: none;
}

.suburb__count {
  margin: 0.5rem 0 0;
  text-align: center;
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
