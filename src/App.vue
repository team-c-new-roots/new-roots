<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'
import { pageTitle } from '@/router'
import SkipLink from '@/components/layout/SkipLink.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import LanguageNotice from '@/components/layout/LanguageNotice.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import RouteAnnouncer from '@/components/layout/RouteAnnouncer.vue'

const { locale } = useI18n()
const route = useRoute()

// a language change has to retitle the page too, not just the visible words
watch(locale, () => {
  document.title = pageTitle(route)
})
</script>

<template>
  <SkipLink />
  <AppHeader />
  <LanguageNotice />
  <main id="main-content" class="app-main" tabindex="-1">
    <RouterView />
  </main>
  <AppFooter />
  <RouteAnnouncer />
</template>
