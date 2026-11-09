<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ChevronDown } from '@lucide/vue'
import { useLanguageStore } from '@/stores/language'
import type { AppLanguageCode } from '@/data/languages'

/* the language pill in every header. a native select under the styling, which
   is the most dependable control there is on a cheap Android phone. options
   show each name in its own script, the same as the language screen */

const { t } = useI18n()
const language = useLanguageStore()

function onChange(event: Event) {
  language.choose((event.target as HTMLSelectElement).value as AppLanguageCode)
}
</script>

<template>
  <div class="language-select">
    <label for="header-language" class="visually-hidden">{{ t('app.language') }}</label>
    <select id="header-language" :value="language.code" @change="onChange">
      <option
        v-for="option in language.options"
        :key="option.code"
        :value="option.code"
        :lang="option.code"
      >
        {{ option.nativeName }}
      </option>
    </select>
    <ChevronDown class="language-select__caret" :size="18" aria-hidden="true" />
  </div>
</template>

<style scoped>
.language-select {
  position: relative;
  display: inline-flex;
}

select {
  min-height: var(--nr-target);
  max-width: 9.5rem;
  padding-block: 0;
  padding-inline: 1rem 2.25rem;
  border: 0;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-apricot);
  color: var(--nr-wine);
  font: inherit;
  font-weight: 700;
  appearance: none;
  cursor: pointer;
}

select:focus-visible {
  outline-color: var(--nr-focus-on-dark);
}

.language-select__caret {
  position: absolute;
  inset-inline-end: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--nr-wine);
  pointer-events: none;
}
</style>
