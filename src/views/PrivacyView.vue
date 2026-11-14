<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/* plain answers to the questions people ask before typing anything
   in: what you ask, where it goes, who else can see it. it only claims what
   the build does: the ranking happens on the phone, so answers never leave
   it (US 6.2). if that ever changes, this page changes in the same PR */

const { t } = useI18n()

const sections = [
  { id: 'collect', heading: 'privacy.collectHeading', body: 'privacy.collect' },
  { id: 'never', heading: 'privacy.neverHeading', body: 'privacy.never' },
  { id: 'where', heading: 'privacy.whereHeading', body: 'privacy.where' },
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
