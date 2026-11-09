<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAnswersStore } from '@/stores/answers'
import { useFlash } from '@/composables/useFlash'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

/* Clear my details, from the header, the menu and the results bar. asks
   first, because on a shared phone a mis-tap shouldn't wipe a family's
   answers. after clearing it goes back to the start, which says the details
   are gone */

// two root nodes, so attrs like class go to the button on purpose
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{ variant?: 'outline' | 'header' }>(), { variant: 'outline' })

const emit = defineEmits<{ cleared: [] }>()

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()
const { set } = useFlash()
const dialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

function clearAll() {
  answers.clear()
  set('cleared')
  emit('cleared')
  router.push({ name: 'intro' })
}
</script>

<template>
  <button
    v-bind="$attrs"
    type="button"
    :class="variant === 'header' ? 'clear-header' : 'btn btn--outline'"
    @click="dialog?.open()"
  >
    {{ t('clear.button') }}
  </button>
  <ConfirmDialog
    ref="dialog"
    :title="t('clear.title')"
    :body="t('clear.body')"
    :confirm-label="t('clear.confirm')"
    :cancel-label="t('clear.cancel')"
    @confirm="clearAll"
  />
</template>

<style scoped>
/* cream outline pill for the wine header. its own focus colour too, since
   the header's cream focus rule can't reach inside this component */
.clear-header {
  min-height: var(--nr-target);
  padding: 0 1rem;
  border: 2px solid var(--nr-cream);
  border-radius: var(--nr-radius-pill);
  background: transparent;
  color: var(--nr-cream);
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.clear-header:hover {
  background: var(--nr-cream);
  color: var(--nr-wine);
}

.clear-header:focus-visible {
  outline-color: var(--nr-focus-on-dark);
}
</style>
