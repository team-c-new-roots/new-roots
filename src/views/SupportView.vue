<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowUp, Check, LayoutGrid, Languages, Siren } from '@lucide/vue'
import {
  CATEGORIES,
  SUPPORT_CHECKED,
  SUPPORT_SERVICES,
  type ServiceCategory,
} from '@/data/support-services'
import ServiceCard from '@/components/support/ServiceCard.vue'
import ExternalLink from '@/components/ui/ExternalLink.vue'

/* the one-stop directory (US 3.3). emergency and interpreter help sit above
   everything, then a short button for each need, like Ask Izzy, which
   Ishara used when she first moved here. picking one scrolls to the list,
   with a line saying what that need covers and a way back up. the seeking
   asylum filter hides services that need permanent residency, so Reza isn't
   sent somewhere that will turn him away. the count is a live region, so
   filtering is announced. ?need=housing opens on one need, for links from
   the results page. anything we don't list goes on to Ask Izzy */

const { t } = useI18n()
const route = useRoute()
const category = ref<ServiceCategory | 'all'>('all')
const asylumOnly = ref(false)

const known = (value: unknown): value is ServiceCategory =>
  CATEGORIES.some((entry) => entry.id === value)

watch(
  () => route.query.need,
  (need) => {
    category.value = known(need) ? need : 'all'
  },
  { immediate: true },
)

const services = computed(() =>
  SUPPORT_SERVICES.filter(
    (service) =>
      (category.value === 'all' || service.categories.includes(category.value)) &&
      !(asylumOnly.value && service.visaNote === 'permanentOnly'),
  ),
)

const chosen = computed(() => CATEGORIES.find((entry) => entry.id === category.value))

const listHeading = ref<HTMLElement | null>(null)
const filtersHeading = ref<HTMLElement | null>(null)

function scrollTo(target: HTMLElement | null) {
  if (!target) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  target.focus({ preventScroll: true })
}

// choose a need, then go to what's in it. focus moves too, so a screen
// reader starts reading the list rather than staying on the buttons
async function choose(value: ServiceCategory | 'all') {
  category.value = value
  await nextTick()
  scrollTo(listHeading.value)
}
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
      <h2 id="support-filter-label" ref="filtersHeading" class="support__question" tabindex="-1">
        {{ t('support.filterLabel') }}
      </h2>
      <div class="support__tiles">
        <button
          type="button"
          class="support__tile"
          :aria-pressed="category === 'all' ? 'true' : 'false'"
          @click="choose('all')"
        >
          <LayoutGrid :size="22" aria-hidden="true" />
          <span>{{ t('support.all') }}</span>
        </button>
        <button
          v-for="entry in CATEGORIES"
          :key="entry.id"
          type="button"
          class="support__tile"
          :aria-pressed="category === entry.id ? 'true' : 'false'"
          @click="choose(entry.id)"
        >
          <component :is="entry.icon" :size="22" aria-hidden="true" />
          <span>{{ t(`support.categories.${entry.id}`) }}</span>
        </button>
      </div>
      <button
        type="button"
        class="support__toggle"
        :aria-pressed="asylumOnly ? 'true' : 'false'"
        @click="asylumOnly = !asylumOnly"
      >
        <Check v-if="asylumOnly" :size="18" :stroke-width="3" aria-hidden="true" />
        {{ t('support.asylumOnly') }}
      </button>
    </div>

    <div class="support__results">
      <h2 ref="listHeading" class="support__results-title" tabindex="-1">
        {{ chosen ? t(`support.categories.${chosen.id}`) : t('support.allTitle') }}
      </h2>
      <p class="support__results-hint">
        {{ chosen ? t(`support.categoryHints.${chosen.id}`) : t('support.allHint') }}.
        <span aria-live="polite">{{
          t('support.count', { n: services.length }, services.length)
        }}</span>
      </p>
      <button type="button" class="link-action support__back" @click="scrollTo(filtersHeading)">
        <ArrowUp :size="18" aria-hidden="true" />
        {{ t('support.changeNeed') }}
      </button>
    </div>

    <ul class="support__list">
      <li v-for="service in services" :key="service.id">
        <ServiceCard :service="service" :checked="SUPPORT_CHECKED" />
      </li>
    </ul>

    <div class="panel support__more">
      <h2>{{ t('support.moreHeading') }}</h2>
      <p>{{ t('support.moreBody') }}</p>
      <ExternalLink :href="chosen?.askIzzy ?? 'https://askizzy.org.au'">
        {{
          chosen?.askIzzy
            ? t('support.moreLinkNeed', { need: t(`support.categories.${chosen.id}`) })
            : t('support.moreLink')
        }}
      </ExternalLink>
    </div>

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
  color: var(--nr-wine-text);
}

.support__alert p {
  margin: 0;
  font-weight: 600;
}

.support__alert .btn {
  grid-column: 1 / -1;
}

.support__alert--urgent {
  border: 3px solid var(--nr-wine-line);
  background: var(--nr-surface-raised);
}

.support__filters {
  margin-top: 1.75rem;
}

.support__question {
  font-size: 1.25rem;
}

/* a short button per need, two to a row on a phone and three on a wider
   screen, so all ten fit in a few rows. what each covers shows once chosen */
.support__tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.support__tile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--nr-target);
  padding: 0.5rem 0.75rem;
  border: 2px solid transparent;
  border-radius: var(--nr-radius-sm);
  background: var(--nr-apricot);
  color: var(--nr-wine-text);
  font: inherit;
  font-weight: 700;
  line-height: 1.25;
  text-align: start;
  cursor: pointer;
}

.support__tile svg {
  flex: none;
  color: var(--nr-rust);
}

.support__tile:hover {
  background: var(--nr-apricot-strong);
}

.support__tile[aria-pressed='true'] {
  border-color: var(--nr-wine-line);
  background: var(--nr-wine);
  color: var(--nr-cream);
}

.support__tile[aria-pressed='true'] svg {
  color: var(--nr-cream);
}

:root[data-theme='contrast'] .support__tile {
  border-color: var(--nr-border-strong);
}

.support__results {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--nr-line);
}

.support__results-title {
  margin-bottom: 0.25rem;
  scroll-margin-top: calc(var(--nr-header-height) + 1rem);
}

.support__results-title:focus,
.support__question:focus {
  outline: none;
}

.support__question {
  scroll-margin-top: calc(var(--nr-header-height) + 1rem);
}

.support__results-hint {
  margin-bottom: 0.25rem;
}

.support__back {
  margin: 0 0 1rem -0.75rem;
}

.support__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: var(--nr-target);
  padding: 0.5rem 1.1rem;
  border: 2px solid var(--nr-wine-line);
  border-radius: var(--nr-radius-pill);
  background: transparent;
  color: var(--nr-wine-text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.support__toggle:hover {
  background: var(--nr-apricot);
}

.support__toggle[aria-pressed='true'] {
  background: var(--nr-wine);
  color: var(--nr-cream);
}

.support__list {
  display: grid;
  gap: 1rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}

.support__more {
  margin-bottom: 1.5rem;
}

.support__more a {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
}

@media (min-width: 40rem) {
  .support__alert {
    grid-template-columns: auto 1fr auto;
    align-items: center;
  }

  .support__alert .btn {
    grid-column: auto;
  }

  .support__tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
