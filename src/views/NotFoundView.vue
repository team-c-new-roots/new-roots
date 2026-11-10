<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="page page--narrow">
    <h1>{{ t('notFound.title') }}</h1>
    <p>{{ t('notFound.body') }}</p>
    <RouterLink :to="{ name: 'intro' }" class="btn btn--primary">{{
      t('notFound.home')
    }}</RouterLink>
  </div>
</template>
