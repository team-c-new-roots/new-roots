<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Menu } from '@lucide/vue'
import { useNavLinks } from '@/composables/useNavLinks'
import { useAnswersStore } from '@/stores/answers'
import NavPanel from './NavPanel.vue'
import LanguageSelect from './LanguageSelect.vue'
import ClearDetailsButton from './ClearDetailsButton.vue'
import logo1x from '@/assets/brand/logo-on-dark.webp'
import logo2x from '@/assets/brand/logo-on-dark@2x.webp'
import logo3x from '@/assets/brand/logo-on-dark@3x.webp'
import mark1x from '@/assets/brand/mark-on-dark.webp'
import mark2x from '@/assets/brand/mark-on-dark@2x.webp'
import mark3x from '@/assets/brand/mark-on-dark@3x.webp'

/* menu, logo and language pill in every header, from the wireframe. from
   72rem up there's room for everything, so the links and Clear my details
   move into the header itself and the menu button goes. below that the menu
   holds them. either way the same things are one tap or click away, and
   Clear my details only appears once there's something to clear.
   72rem rather than 64rem because the links are 19px for contrast, and the
   clear button didn't fit beside them on a 1024px screen.
   below 340px the wordmark drops to the house mark so the language pill
   still fits, which is art direction, so it's a <picture> source not srcset */

const { t } = useI18n()
const links = useNavLinks()
const answers = useAnswersStore()
const navOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)

const logoSrcset = `${logo1x} 1x, ${logo2x} 2x, ${logo3x} 3x`
const markSrcset = `${mark1x} 1x, ${mark2x} 2x, ${mark3x} 3x`
</script>

<template>
  <header class="app-header">
    <div class="page app-header__inner">
      <button
        ref="menuButton"
        type="button"
        class="icon-button app-header__menu"
        aria-haspopup="dialog"
        :aria-expanded="navOpen ? 'true' : 'false'"
        @click="navOpen = true"
      >
        <Menu :size="30" aria-hidden="true" />
        <span class="visually-hidden">{{ t('app.menu') }}</span>
      </button>

      <RouterLink :to="{ name: 'intro' }" class="app-header__brand">
        <picture>
          <source media="(max-width: 339.98px)" :srcset="markSrcset" width="30" height="32" />
          <img :src="logo1x" :srcset="logoSrcset" :alt="t('app.home')" width="139" height="32" />
        </picture>
      </RouterLink>

      <nav class="app-header__nav" :aria-label="t('nav.label')">
        <ul>
          <li v-for="link in links.filter((item) => item.inHeader)" :key="link.key">
            <RouterLink :to="link.to">{{ link.label }}</RouterLink>
          </li>
        </ul>
      </nav>

      <ClearDetailsButton v-if="answers.hasAnswers" variant="header" class="app-header__clear" />
      <LanguageSelect class="app-header__language" />
    </div>
  </header>

  <NavPanel v-model:open="navOpen" :links="links" :return-focus="menuButton" />
</template>

<style scoped>
/* sticky for two reasons. the menu, language and clear buttons stay in reach
   on long pages, and Safari 26 on iPhone ignores theme-color and tints the
   status bar from a fixed or sticky bar at the top, so this is what turns
   the time and battery area wine. no backdrop blur here, it stops Safari
   sampling the colour */
.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--nr-wine);
  color: var(--nr-cream);
  border-bottom: 4px solid var(--nr-rust);
}

/* the focus ring has to show against wine, so it flips to cream in here */
.app-header :focus-visible {
  outline-color: var(--nr-focus-on-dark);
}

.app-header__inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 4.25rem;
  padding-block: 0.5rem;
}

.app-header__brand {
  display: inline-flex;
  align-items: center;
  min-height: var(--nr-target);
  padding-inline: 0.25rem;
  border-radius: var(--nr-radius-sm);
}

.app-header__brand img {
  display: block;
  height: 32px;
  width: auto;
}

.app-header__nav {
  display: none;
  margin-inline-start: auto;
}

.app-header__language {
  margin-inline-start: auto;
}

/* hidden until there's room for it, the menu has it below 72rem. :deep
   because the button lives inside ClearDetailsButton, which has two roots
   and so never picks up this component's scoped attribute */
.app-header__inner :deep(.app-header__clear) {
  display: none;
}

@media (min-width: 72rem) {
  .app-header__menu {
    display: none;
  }

  .app-header__inner :deep(.app-header__clear) {
    display: inline-flex;
    align-items: center;
    margin-inline-start: 1rem;
  }

  .app-header__nav {
    display: block;
  }

  .app-header__language {
    margin-inline-start: 1rem;
  }

  .app-header__nav ul {
    display: flex;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* 19px bold counts as large text, which is what lets orange on wine pass
     AA at 3.6:1. any smaller and the orange states would fail */
  .app-header__nav a {
    display: inline-flex;
    align-items: center;
    min-height: var(--nr-target);
    padding-inline: 0.85rem;
    border-radius: var(--nr-radius-sm);
    color: var(--nr-cream);
    font-size: 1.1875rem;
    font-weight: 700;
    text-decoration: none;
  }

  .app-header__nav a:hover,
  .app-header__nav a[aria-current='page'] {
    color: var(--nr-orange);
  }
}
</style>
