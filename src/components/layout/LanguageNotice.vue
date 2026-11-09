<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X } from '@lucide/vue'
import { useLanguageStore } from '@/stores/language'

/* someone picked a language whose translation isn't ready yet. say so plainly
   rather than switching to English with no explanation. goes once the translations ship */

const { t } = useI18n()
const language = useLanguageStore()
</script>

<template>
  <div v-if="language.showNotice" class="language-notice" role="status">
    <div class="page language-notice__inner">
      <p>
        {{ t('languageNotice.text', { language: t(language.current.nameKey) }) }}
      </p>
      <button type="button" class="icon-button" @click="language.dismissNotice()">
        <X :size="22" aria-hidden="true" />
        <span class="visually-hidden">{{ t('app.dismiss') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.language-notice {
  background: var(--nr-apricot);
  border-bottom: 2px solid var(--nr-line);
}

.language-notice__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.language-notice p {
  margin: 0;
  padding-block: 0.5rem;
  font-weight: 600;
}
</style>
