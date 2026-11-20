<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ExternalLink from '@/components/ui/ExternalLink.vue'

// a way to check which payment you get, right by the question (panel feedback)

const { t } = useI18n()
</script>

<template>
  <p class="centrelink-hint">
    {{ t('income.notSure') }}
    <ExternalLink href="https://www.servicesaustralia.gov.au/centrelink">
      {{ t('income.centrelinkLink') }}
    </ExternalLink>
  </p>
</template>

<style scoped>
.centrelink-hint {
  margin: -0.5rem 0 1.5rem;
}

.centrelink-hint a {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
}
</style>
