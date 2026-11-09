<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'
import ErrorSummary from '@/components/ui/ErrorSummary.vue'

/* the frame around each question: step count, progress bar, the form, then
   Next and Back. one question per screen, per the wireframe. the step view
   checks its own answers and hands any errors in. focus moves to the summary
   on a failed submit only, so errors can clear as they're fixed without
   pulling focus away from the field being answered */

const TOTAL_STEPS = 4

const props = withDefaults(
  defineProps<{
    step: number
    back: RouteLocationRaw
    errors?: Record<string, string>
    nextLabel?: string
  }>(),
  { errors: () => ({}), nextLabel: undefined },
)

const emit = defineEmits<{ next: [] }>()

const { t } = useI18n()
const summary = ref<InstanceType<typeof ErrorSummary> | null>(null)

async function submit() {
  // the step's handler runs during emit, so its errors are already set here
  emit('next')
  await nextTick()
  if (Object.keys(props.errors).length > 0) summary.value?.focus()
}
</script>

<template>
  <div class="page page--narrow step">
    <p class="step__count">{{ t('steps.stepOf', { step, total: TOTAL_STEPS }) }}</p>
    <div class="step__bar" aria-hidden="true">
      <span :style="{ inlineSize: `${(step / TOTAL_STEPS) * 100}%` }"></span>
    </div>

    <form class="step__form" novalidate @submit.prevent="submit">
      <ErrorSummary ref="summary" :errors="errors" />
      <slot />
      <div class="step__actions">
        <button type="submit" class="btn btn--primary btn--block">
          {{ nextLabel ?? t('steps.next') }}
        </button>
        <RouterLink :to="back" class="link-action">
          <ChevronLeft class="flip-rtl" :size="20" aria-hidden="true" />
          {{ t('steps.back') }}
        </RouterLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
.step__count {
  margin-bottom: 0.5rem;
  font-weight: 700;
}

.step__bar {
  height: 0.75rem;
  margin-bottom: 1.75rem;
  overflow: hidden;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-apricot);
}

.step__bar span {
  display: block;
  height: 100%;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-wine);
}

.step__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
}
</style>
