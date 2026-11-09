<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ExternalLink as ExternalIcon } from '@lucide/vue'

// links that leave New Roots open in a new tab. the answers only live in this
// tab's memory, so following a link away in the same tab and coming back
// would lose them. the new tab is announced, not sprung on anyone

defineProps<{ href: string }>()
const { t } = useI18n()
</script>

<template>
  <a :href="href" target="_blank" rel="noopener noreferrer" class="external-link">
    <slot />
    <ExternalIcon class="external-link__icon" :size="15" aria-hidden="true" />
    <span class="visually-hidden">{{ t('app.newTab') }}</span>
  </a>
</template>

<style scoped>
.external-link__icon {
  margin-inline-start: 0.25rem;
  vertical-align: -0.1em;
}
</style>
