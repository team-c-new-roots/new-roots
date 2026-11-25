<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ClipboardList, Handshake, ListChecks, Printer, Route, Search } from '@lucide/vue'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import { GOOGLE_TRANSIT, JOURNEY_PLANNER } from '@/data/journeyPlanners'

/* the results answer "where", this answers "what now" (teacher feedback:
   lots of information, not much to act on). six steps in the order people
   take them, each with something to tap. what agents can ask for comes from
   Consumer Affairs Victoria's rules for the standard application form, which
   all private rentals have used since 31 March 2026 */

defineProps<{ count: number; max: number }>()

const { t } = useI18n()
</script>

<template>
  <section id="next-steps" class="next-steps" aria-labelledby="next-steps-heading">
    <h2 id="next-steps-heading">{{ t('nextSteps.title') }}</h2>
    <ol class="next-steps__list">
      <li>
        <ListChecks :size="24" aria-hidden="true" />
        <div>
          <h3>{{ t('nextSteps.pickTitle', { max }) }}</h3>
          <p>{{ t('nextSteps.pickBody', { count, max }) }}</p>
        </div>
      </li>
      <li>
        <Printer :size="24" aria-hidden="true" />
        <div>
          <h3>{{ t('nextSteps.printTitle') }}</h3>
          <p>{{ t('nextSteps.printBody') }}</p>
          <RouterLink :to="{ name: 'summary' }" class="btn btn--accent next-steps__button">
            {{ t('results.print') }}
          </RouterLink>
        </div>
      </li>
      <li>
        <ClipboardList :size="24" aria-hidden="true" />
        <div>
          <h3>{{ t('nextSteps.readyTitle') }}</h3>
          <p>{{ t('nextSteps.readyBody') }}</p>
          <ExternalLink href="https://www.consumer.vic.gov.au/applying">
            {{ t('nextSteps.readyLink') }}
          </ExternalLink>
        </div>
      </li>
      <li>
        <Search :size="24" aria-hidden="true" />
        <div>
          <h3>{{ t('nextSteps.searchTitle') }}</h3>
          <p>{{ t('nextSteps.searchBody') }}</p>
          <p class="next-steps__links">
            <ExternalLink href="https://www.realestate.com.au/rent/"
              >realestate.com.au</ExternalLink
            >
            <ExternalLink href="https://www.domain.com.au/rent/">Domain</ExternalLink>
          </p>
        </div>
      </li>
      <li>
        <Route :size="24" aria-hidden="true" />
        <div>
          <h3>{{ t('nextSteps.tripTitle') }}</h3>
          <p>{{ t('nextSteps.tripBody') }}</p>
          <p class="next-steps__links">
            <ExternalLink :href="GOOGLE_TRANSIT">Google Maps</ExternalLink>
            <ExternalLink :href="JOURNEY_PLANNER">{{ t('nextSteps.tripPlanner') }}</ExternalLink>
          </p>
        </div>
      </li>
      <li>
        <Handshake :size="24" aria-hidden="true" />
        <div>
          <h3>{{ t('nextSteps.helpTitle') }}</h3>
          <p>{{ t('nextSteps.helpBody') }}</p>
          <RouterLink :to="{ name: 'support', query: { need: 'housing' } }">
            {{ t('nextSteps.helpLink') }}
          </RouterLink>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.next-steps {
  margin: 0;
  padding: 1.25rem;
  border: 2px solid var(--nr-wine-line);
  border-radius: var(--nr-radius);
  background: var(--nr-surface-raised);
}

.next-steps__list {
  display: grid;
  gap: 1rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.next-steps__list > li {
  display: flex;
  gap: 0.85rem;
  padding-top: 1rem;
  border-top: 1px solid var(--nr-line);
}

.next-steps__list > li:first-child {
  padding-top: 0;
  border-top: 0;
}

.next-steps__list > li > svg {
  flex: none;
  margin-top: 0.1rem;
  color: var(--nr-rust);
}

.next-steps h3 {
  margin-bottom: 0.25rem;
  color: var(--nr-wine-text);
}

/* the step number goes before each heading, so the order reads without the icons */
.next-steps h3::before {
  counter-increment: step;
  content: counter(step) '. ';
}

.next-steps p {
  margin-bottom: 0.4rem;
}

.next-steps a {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
}

.next-steps__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1.25rem;
}

.next-steps__button {
  margin-top: 0.25rem;
}

@media (min-width: 64rem) {
  .next-steps__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem 2rem;
  }

  .next-steps__list > li:nth-child(2) {
    padding-top: 0;
    border-top: 0;
  }
}
</style>
