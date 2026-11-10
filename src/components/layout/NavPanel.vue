<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from '@lucide/vue'
import type { NavLink } from '@/composables/useNavLinks'
import { useAnswersStore } from '@/stores/answers'
import ClearDetailsButton from './ClearDetailsButton.vue'

/* the menu panel. a native <dialog> with showModal(), not a hand-rolled
   drawer, so the page behind goes inert and Escape closes it for free.

   focus goes back to the menu button when it's dismissed, but not when a link
   was followed. the router moves focus to <main> after a navigation, and
   handing it back to the menu button after that would undo it */

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  links: NavLink[]
  returnFocus: HTMLElement | null
}>()

const { t } = useI18n()
const answers = useAnswersStore()
const dialog = ref<HTMLDialogElement | null>(null)
let restoreFocus = true

watch(open, (isOpen) => {
  if (isOpen && !dialog.value?.open) {
    restoreFocus = true
    dialog.value?.showModal()
  }
  if (!isOpen && dialog.value?.open) dialog.value.close()
})

function onClose() {
  open.value = false
  if (restoreFocus) props.returnFocus?.focus()
}

function leave() {
  restoreFocus = false
  dialog.value?.close()
}

// a click that lands on the dialog itself, not its contents, is the backdrop
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="nav-panel"
    aria-labelledby="nav-panel-title"
    @close="onClose"
    @click="onClick"
  >
    <div class="nav-panel__inner">
      <div class="nav-panel__top">
        <h2 id="nav-panel-title" class="nav-panel__title">{{ t('nav.label') }}</h2>
        <button type="button" class="icon-button" @click="dialog?.close()">
          <X :size="26" aria-hidden="true" />
          <span class="visually-hidden">{{ t('app.closeMenu') }}</span>
        </button>
      </div>

      <nav :aria-label="t('nav.label')">
        <ul class="nav-panel__links">
          <li v-for="link in links" :key="link.key">
            <RouterLink :to="link.to" class="nav-panel__link" @click="leave">
              {{ link.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div v-if="answers.hasAnswers" class="nav-panel__footer">
        <ClearDetailsButton class="btn--block" @cleared="leave" />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.nav-panel {
  width: min(20rem, 88vw);
  height: 100dvh;
  max-height: none;
  margin: 0;
  margin-inline-end: auto;
  padding: 0;
  border: 0;
  background: var(--nr-surface);
  color: var(--nr-ink);
}

.nav-panel[open] {
  animation: slide-in 0.2s ease-out;
}

.nav-panel::backdrop {
  background: var(--nr-backdrop);
}

[dir='rtl'] .nav-panel[open] {
  animation-name: slide-in-rtl;
}

@keyframes slide-in {
  from {
    transform: translateX(-100%);
  }
}

@keyframes slide-in-rtl {
  from {
    transform: translateX(100%);
  }
}

.nav-panel__inner {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 0.75rem 1.25rem 1.5rem;
}

.nav-panel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.nav-panel__title {
  margin: 0;
  font-size: 1.25rem;
}

.nav-panel__links {
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-panel__link {
  display: flex;
  align-items: center;
  min-height: 3.25rem;
  border-bottom: 1px solid var(--nr-line);
  color: var(--nr-wine);
  font-size: 1.125rem;
  font-weight: 700;
  text-decoration: none;
}

/* same rule as the header, orange text and nothing else. on cream that has
   to be the dark orange, autumn orange is only 2.6:1 there */
.nav-panel__link:hover,
.nav-panel__link[aria-current='page'] {
  color: var(--nr-rust);
}

.nav-panel__footer {
  margin-top: auto;
  padding-top: 1.5rem;
}
</style>
