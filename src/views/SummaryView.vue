<script setup lang="ts">
import { computed, ref } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import {
  Check,
  ChevronLeft,
  KeyRound,
  ListChecks,
  Lock,
  MapPin,
  Printer,
  Users,
  Wallet,
} from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useResults } from '@/composables/useResults'
import { useFormat } from '@/composables/useFormat'
import { useSuburbFacts } from '@/composables/useSuburbFacts'
import { useSummary } from '@/composables/useSummary'
import { metricValue, type SuburbResult } from '@/services/results'
import { RATES_FROM } from '@/data/centrelink-rates'
import { DATA_UPDATED } from '@/data/datasets'
import { MOVE_IN } from '@/data/move-in'
import { moveInCost } from '@/services/moveIn'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import ResultsGate from '@/components/results/ResultsGate.vue'
import logoLight1x from '@/assets/brand/logo-on-light.webp'
import logoLight2x from '@/assets/brand/logo-on-light@2x.webp'

/* the page someone takes to a caseworker (US 2.4). household, budget and up
   to five suburbs with their rent and the distances that matter, and nothing
   that identifies them. fits on one A4 page with all five. printing goes through the
   browser's own print dialog, which also offers Save as PDF, so the summary
   never leaves the device unless they choose to send it */

const { t, d } = useI18n()
const answers = useAnswersStore()
const { status, errorKind, derived, retry } = useResults()
const { money, home, monthYear, fullDate, km } = useFormat()
const facts = useSuburbFacts()
const summary = useSummary(derived)
const announcement = ref('')

const budget = computed(() => answers.budget)
const usesPayments = computed(
  () => answers.incomeSource === 'payments' || answers.incomeSource === 'both',
)

// their top three, or their own list once they've added or removed one
const picks = computed<SuburbResult[]>(() => {
  const found = derived.value
  if (!found) return []
  return summary.ids.value
    .map((id) => found.byId.get(id))
    .filter((item): item is SuburbResult => item !== undefined)
})

function remove(item: SuburbResult) {
  summary.toggle(item.id)
  announcement.value = t('suburb.removed', { suburb: item.name })
}

// "Schools: primary 0.5 km, secondary 1.6 km", with the estimate flag up by
// the rent, so each suburb's distances fit one line on paper
// the shorter one-line version of the distances, for paper only
function distances(item: SuburbResult): string[] {
  const schools = facts.schoolMetrics.value.flatMap((level) => {
    const distance = metricValue(item.obt, `${level}_school_proximity`)
    return distance === null ? [] : [t(`summary.${level}Short`, { distance: km(distance) })]
  })
  return [
    schools.length ? t('summary.schools', { list: schools.join(', ') }) : null,
    facts.englishLine(item),
  ].filter((line): line is string => line !== null)
}

// US 1.3, on screen and paper, so the caseworker sees the upfront cost too.
// paper gets the short version, the note under the list says what it covers
function moveInLine(item: SuburbResult, paper = false): string | null {
  if (item.rent === null) return null
  const cost = moveInCost(item.rent)
  const key = paper ? 'moveIn.paper' : 'moveIn.summary'
  return t(cost.limited ? key : `${key}Over`, { amount: money(cost.total) })
}

// paper gets the move-in cost on the distances line, so it costs no extra
// line per suburb
function paperLine(item: SuburbResult): string[] {
  const moveIn = moveInLine(item, true)
  return moveIn ? [moveIn, ...distances(item)] : distances(item)
}

const anyRent = computed(() => picks.value.some((item) => item.rent !== null))

const anyEstimate = computed(() => picks.value.some((item) => facts.rentEstimate(item) !== null))

const householdLine = computed(() =>
  t('summary.people', {
    adults: t('units.adults', answers.adults),
    children: t('units.children', answers.children),
    home: home(answers.home.asked),
  }),
)

const today = computed(() => d(new Date(), 'long'))

function print() {
  window.print()
}
</script>

<template>
  <div class="page page--narrow summary">
    <img
      class="print-only summary__logo"
      :src="logoLight1x"
      :srcset="`${logoLight1x} 1x, ${logoLight2x} 2x`"
      :alt="t('app.name')"
      width="173"
      height="40"
    />

    <h1>{{ t('summary.title') }}</h1>
    <!-- an instruction for the screen, so paper has room for five suburbs -->
    <p class="lead no-print">{{ t('summary.lead') }}</p>

    <section class="panel summary__block" aria-labelledby="household-heading">
      <h2 id="household-heading" class="summary__heading">
        <Users :size="24" aria-hidden="true" />
        {{ t('summary.household') }}
      </h2>
      <p>{{ householdLine }}</p>
      <p v-if="budget">
        {{
          budget.rentAssistanceWeekly > 0
            ? t('summary.budgetWithRa', { amount: money(budget.weekly) })
            : t('summary.budget', { amount: money(budget.weekly) })
        }}
      </p>
      <p v-if="usesPayments" class="muted">
        {{ t('summary.ratesFrom', { date: monthYear(RATES_FROM) }) }}
      </p>
    </section>

    <section class="panel summary__block" aria-labelledby="suburbs-heading">
      <h2 id="suburbs-heading" class="summary__heading">
        <MapPin :size="24" aria-hidden="true" />
        {{ t('summary.suburbs') }}
      </h2>
      <ResultsGate :status="status" :error-kind="errorKind" @retry="retry">
        <template v-if="picks.length">
          <p class="muted no-print">
            {{
              summary.chosen.value
                ? t('summary.yourPicks', { max: summary.max })
                : t('summary.topThree', { max: summary.max })
            }}
          </p>
          <ol class="summary__suburbs">
            <li v-for="(item, index) in picks" :key="item.id" class="summary__item">
              <span class="summary__number" aria-hidden="true">{{ index + 1 }}</span>
              <div class="summary__body">
                <p class="summary__title">
                  <span class="summary__name">{{ item.name }}</span>
                  <span class="summary__status">{{ t(`status.${item.status}`) }}</span>
                </p>
                <ul class="summary__facts">
                  <li v-if="item.rent !== null" class="summary__rent">
                    <Wallet :size="18" aria-hidden="true" />
                    {{
                      facts.rentEstimate(item)
                        ? t('summary.rentEstimated', { amount: money(item.rent) })
                        : t('income.budgetValue', { amount: money(item.rent) })
                    }}
                  </li>
                  <li v-if="moveInLine(item)" class="summary__move-in">
                    <KeyRound :size="18" aria-hidden="true" />
                    {{ moveInLine(item) }}
                  </li>
                  <li
                    v-for="fact in facts.distanceFacts(item)"
                    :key="fact.key"
                    class="summary__distance"
                  >
                    <component :is="fact.icon" :size="18" aria-hidden="true" />
                    {{ fact.text }}
                  </li>
                </ul>
                <p v-if="paperLine(item).length" class="summary__distances print-only">
                  {{ paperLine(item).join(' · ') }}
                </p>
              </div>
              <button type="button" class="summary__remove no-print" @click="remove(item)">
                {{ t('results.removeFromSummary') }}
                <span class="visually-hidden">{{
                  t('results.fromSummary', { suburb: item.name })
                }}</span>
              </button>
            </li>
          </ol>
          <p v-if="anyEstimate" class="summary__estimate-note">{{ t('summary.estimateNote') }}</p>
          <I18nT
            v-if="anyRent"
            keypath="moveIn.summaryNote"
            tag="p"
            scope="global"
            class="summary__estimate-note"
          >
            <template #limit>{{ money(MOVE_IN.weeklyLimit) }}</template>
            <template #date>{{ fullDate(MOVE_IN.checked) }}</template>
            <template #cav>
              <ExternalLink :href="MOVE_IN.cavUrl">Consumer Affairs Victoria</ExternalLink>
            </template>
          </I18nT>
        </template>
        <p v-else>
          {{
            summary.chosen.value
              ? t('summary.noPicks', { max: summary.max })
              : t('summary.noSuburbs')
          }}
        </p>
        <p class="visually-hidden" role="status">{{ announcement }}</p>
      </ResultsGate>
    </section>

    <section aria-labelledby="next-heading">
      <h2 id="next-heading" class="summary__heading">
        <ListChecks :size="24" aria-hidden="true" />
        {{ t('summary.nextSteps') }}
      </h2>
      <ul class="icon-list">
        <li>
          <Check :size="22" aria-hidden="true" />
          <I18nT keypath="summary.step1" tag="span" scope="global">
            <template #realestate>
              <ExternalLink href="https://www.realestate.com.au/rent/"
                >realestate.com.au</ExternalLink
              >
            </template>
            <template #domain>
              <ExternalLink href="https://www.domain.com.au/rent/">Domain</ExternalLink>
            </template>
          </I18nT>
        </li>
        <li>
          <Check :size="22" aria-hidden="true" />
          <span>{{ t('summary.step2') }}</span>
        </li>
        <li>
          <Check :size="22" aria-hidden="true" />
          <span>{{ t('summary.stepApply') }}</span>
        </li>
        <li>
          <Check :size="22" aria-hidden="true" />
          <I18nT keypath="summary.step3" tag="span" scope="global">
            <template #findMySchool>
              <ExternalLink href="https://www.findmyschool.vic.gov.au">Find My School</ExternalLink>
            </template>
          </I18nT>
        </li>
      </ul>
    </section>

    <p class="summary__privacy">
      <Lock :size="20" aria-hidden="true" />
      {{ t('summary.privacy') }}
    </p>
    <p class="muted summary__made">
      {{ t('summary.made', { date: today }) }}
      {{ t('summary.dataLine', { date: fullDate(DATA_UPDATED) }) }}
    </p>

    <div class="no-print summary__actions">
      <button type="button" class="btn btn--accent btn--block" @click="print">
        <Printer :size="20" aria-hidden="true" />
        {{ t('summary.print') }}
      </button>
      <RouterLink :to="{ name: 'results' }" class="link-action">
        <ChevronLeft class="flip-rtl" :size="20" aria-hidden="true" />
        {{ t('summary.back') }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.summary__logo {
  margin-bottom: 1rem;
}

.summary__block {
  margin-bottom: 1.25rem;
}

.summary__block p {
  margin-bottom: 0.35rem;
}

.summary__suburbs {
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.summary__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary__heading svg {
  flex: none;
  color: var(--nr-rust);
}

/* the number, the name with Remove beside it, then the facts across the
   full width underneath, so they never get squeezed into short lines */
.summary__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    'number title remove'
    'number facts facts';
  align-items: center;
  gap: 0.25rem 0.75rem;
  padding-block: 0.6rem;
}

.summary__body {
  display: contents;
}

.summary__item .summary__number {
  grid-area: number;
  align-self: start;
  margin-top: 0.6rem;
}

.summary__title {
  grid-area: title;
}

.summary__facts {
  grid-area: facts;
}

.summary__remove {
  grid-area: remove;
}

.summary__item + .summary__item {
  border-top: 1px solid var(--nr-line);
}

.summary__body p {
  margin: 0;
}

.summary__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
}

/* one fact per line with its icon, so a figure never wraps away from its
   label or its km */
.summary__facts {
  display: grid;
  gap: 0.2rem;
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
}

.summary__facts li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary__facts svg {
  flex: none;
  color: var(--nr-rust);
}

.summary__estimate-note {
  margin-top: 0.25rem;
  color: var(--nr-ink-muted);
  font-size: 0.9375rem;
}

.summary__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--nr-wine);
  color: var(--nr-cream);
  font-size: 0.875rem;
  font-weight: 700;
}

.summary__name {
  font-weight: 700;
}

/* a small label beside the name, so it reads fine wherever it wraps */
.summary__status {
  padding: 0.05rem 0.6rem;
  border: 1px solid var(--nr-wine-line);
  border-radius: 999px;
  background: var(--nr-surface);
  color: var(--nr-wine-text);
  font-size: 0.875rem;
  font-weight: 700;
}

/* a link-style button, still a full-size target */
.summary__remove {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
  padding: 0;
  border: 0;
  background: none;
  color: var(--nr-rust);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15em;
  cursor: pointer;
}

.summary__remove:hover {
  color: var(--nr-wine-text);
}

.summary__privacy {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.summary__privacy svg {
  flex: 0 0 auto;
  color: var(--nr-rust);
}

.summary__made {
  font-size: 0.9375rem;
}

.summary__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

/* a little less air on paper, so five suburbs with two-line distances
   still fit one A4 page, even with the margins and headers Safari and
   Firefox add. body text stays the same size, only headings come down */
@media print {
  /* the whole width of the paper, so the move-in cost and distances share
     one line under each suburb */
  .summary {
    max-width: none;
  }

  .summary__logo {
    margin-bottom: 0.5rem;
  }

  .summary h1 {
    margin-bottom: 0.5rem;
    font-size: 1.75rem;
  }

  .summary__heading {
    font-size: 1.25rem;
  }

  .summary .icon-list li {
    padding-block: 0.15rem;
  }

  .summary__block p {
    margin-bottom: 0.2rem;
  }

  .summary__block {
    margin-bottom: 0.75rem;
    padding-block: 0.85rem;
  }

  /* on paper: name, status and rent on one line, the distances on the next,
     so five suburbs still fit on one A4 page */
  .summary__item {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: none;
    padding-block: 0.25rem;
  }

  .summary__item .summary__number {
    grid-area: auto;
    margin-top: 0;
  }

  .summary__body {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.1rem 0.75rem;
  }

  .summary__facts {
    display: contents;
  }

  .summary__facts .summary__distance,
  .summary__facts .summary__move-in,
  .summary__facts svg {
    display: none;
  }

  .summary__distances {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.875rem;
  }

  .summary__status {
    padding: 0;
    border: 0;
    background: none;
    color: var(--nr-print-ink);
    font-size: inherit;
  }

  .summary__privacy {
    margin-top: 0.5rem;
  }

  .summary__number {
    border: 1px solid var(--nr-print-ink);
    background: var(--nr-print-paper);
    color: var(--nr-print-ink);
  }
}
</style>
