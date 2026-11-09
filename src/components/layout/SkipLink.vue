<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// first thing in the tab order, hidden until focused. gets keyboard users past the header
const { t } = useI18n()
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('app.skip') }}</a>
</template>
