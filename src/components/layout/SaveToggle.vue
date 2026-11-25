<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bookmark } from '@lucide/vue'
import { useSavedStore } from '@/stores/saved'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

/* US 2.7, Save. a bookmark in a circle that fills wine once it's on, with
   the word beside it so it isn't an icon on its own (US 5.1), and a hover
   tooltip wouldn't work on a phone anyway. screen readers hear "Save my
   answers on this device". turning it on asks first, since anyone using the
   device could see the answers. turning it off doesn't, it only removes */

defineOptions({ inheritAttrs: false })

// a circle beside the word on the steps and results. a full width pill in
// the menu, so it lines up with the theme options and Clear my details
withDefaults(defineProps<{ variant?: 'circle' | 'pill' }>(), { variant: 'circle' })

const { t } = useI18n()
const saved = useSavedStore()
const dialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)
const message = ref('')

function onClick() {
  if (saved.on) {
    saved.stop()
    message.value = t('save.stopped')
    return
  }
  dialog.value?.open()
}

function confirm() {
  message.value = saved.start() ? t('save.saved') : t('save.failed')
}
</script>

<template>
  <button
    v-bind="$attrs"
    type="button"
    :class="variant === 'pill' ? 'btn btn--outline btn--block save-pill' : 'save-toggle'"
    :aria-pressed="saved.on ? 'true' : 'false'"
    @click="onClick"
  >
    <Bookmark v-if="variant === 'pill'" :size="20" aria-hidden="true" />
    <span v-else class="save-toggle__circle" aria-hidden="true">
      <Bookmark :size="20" />
    </span>
    {{ t('save.button') }}
    <span class="visually-hidden">{{ t('save.buttonMore') }}</span>
  </button>
  <p class="visually-hidden" role="status">{{ message }}</p>
  <ConfirmDialog
    ref="dialog"
    :title="t('save.title')"
    :body="t('save.body')"
    :confirm-label="t('save.confirm')"
    :cancel-label="t('save.cancel')"
    @confirm="confirm"
  />
</template>

<style scoped>
/* the whole row is the button, so the tap target is the circle and the words */
.save-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: var(--nr-target);
  padding: 0 0.25rem;
  border: 0;
  border-radius: var(--nr-radius-pill);
  background: transparent;
  color: var(--nr-wine-text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.save-toggle__circle {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--nr-target);
  height: var(--nr-target);
  border: 1px solid var(--nr-line);
  border-radius: 50%;
  background: var(--nr-surface-raised);
  color: var(--nr-wine-text);
}

.save-toggle:hover .save-toggle__circle {
  border-color: var(--nr-wine-text);
  background: var(--nr-toggle-hover);
}

.save-toggle[aria-pressed='true'] .save-toggle__circle,
.save-toggle[aria-pressed='true']:hover .save-toggle__circle {
  border-color: var(--nr-chosen);
  background: var(--nr-chosen);
  color: var(--nr-chosen-ink);
}

.save-toggle[aria-pressed='true'] .save-toggle__circle svg {
  fill: currentColor;
}
.save-pill[aria-pressed='true'],
.save-pill[aria-pressed='true']:hover {
  border-color: var(--nr-chosen);
  background: var(--nr-chosen);
  color: var(--nr-chosen-ink);
}

.save-pill[aria-pressed='true'] svg {
  fill: currentColor;
}
</style>
