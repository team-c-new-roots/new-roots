<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Circle, Heart } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import type { ChoiceOption, Importance } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* step 3, second half. three choices with icons instead of a five point
   scale (US-20). community reorders suburbs but never hides any (US-14),
   and the screen says so right under the choices */

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()

const languageName = computed(() =>
  answers.rankingLanguage ? t(`languages.${answers.rankingLanguage}`) : '',
)

const options = computed<ChoiceOption<Importance>[]>(() => [
  { value: 'not', label: t('importance.not') },
  { value: 'important', label: t('importance.important') },
  { value: 'very', label: t('importance.very') },
])

const importance = computed<Importance | null>({
  get: () => answers.importance.community,
  set: (value) => {
    if (value) answers.importance.community = value
  },
})
</script>

<template>
  <StepLayout
    :step="3"
    :back="{ name: 'community-language' }"
    @next="router.push({ name: 'priorities' })"
  >
    <RadioGroup
      id="community-importance"
      v-model="importance"
      :options="options"
      :legend="t('community.title', { language: languageName })"
      :hint="t('community.note')"
      legend-tag="h1"
      variant="card-strong"
    >
      <template #icon="{ option, checked }">
        <Circle v-if="option.value === 'not'" :size="26" />
        <Heart
          v-else
          :size="26"
          :fill="option.value === 'very' || checked ? 'currentColor' : 'none'"
        />
      </template>
    </RadioGroup>
  </StepLayout>
</template>
