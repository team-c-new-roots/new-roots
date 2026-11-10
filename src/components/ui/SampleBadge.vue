<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// marks anything built on the made-up figures. comes off once the real data is in
const { t } = useI18n()
</script>

<template>
  <span class="badge badge--sample">{{ t('app.sampleData') }}</span>
</template>
