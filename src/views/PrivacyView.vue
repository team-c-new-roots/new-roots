<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usingExample } from '@/services/api'

/* plain answers to the questions people ask before typing anything
   in: what you ask, where it goes, who else can see it. it only claims what
   the build does. while the app shows a saved example nothing is sent, and
   once the scoring API is connected the answers go to it once, so "where
   your answers go" follows whichever this build is doing (US 6.2) */

const { t } = useI18n()

const sections = [
  { id: 'collect', heading: 'privacy.collectHeading', body: 'privacy.collect' },
  { id: 'never', heading: 'privacy.neverHeading', body: 'privacy.never' },
  {
    id: 'where',
    heading: 'privacy.whereHeading',
    body: usingExample ? 'privacy.whereLocal' : 'privacy.whereServer',
  },
  { id: 'tracking', heading: 'privacy.trackingHeading', body: 'privacy.tracking' },
  { id: 'map', heading: 'privacy.mapHeading', body: 'privacy.map' },
  { id: 'shared', heading: 'privacy.sharedHeading', body: 'privacy.shared' },
  { id: 'hosting', heading: 'privacy.hostingHeading', body: 'privacy.hosting' },
]
</script>

<template>
  <div class="page page--narrow">
    <h1>{{ t('privacy.title') }}</h1>
    <p class="lead">{{ t('privacy.lead') }}</p>

    <section
      v-for="section in sections"
      :key="section.id"
      :aria-labelledby="`privacy-${section.id}`"
      class="info-section"
    >
      <h2 :id="`privacy-${section.id}`">{{ t(section.heading) }}</h2>
      <p>{{ t(section.body) }}</p>
    </section>
  </div>
</template>

<style scoped>
.info-section {
  margin-top: 1.75rem;
}
</style>
