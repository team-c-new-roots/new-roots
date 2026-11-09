<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAnswersStore } from '@/stores/answers'
import type { ChoiceOption, Importance } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* step 4. the other two topics. reported crime starts at Not important and
   says why, because crime figures can stigmatise the suburbs new arrivals
   already live in (ethics canvas) */

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()

const options = computed<ChoiceOption<Importance>[]>(() => [
  { value: 'not', label: t('importance.not') },
  { value: 'important', label: t('importance.important') },
  { value: 'very', label: t('importance.very') },
])

const essentials = computed<Importance | null>({
  get: () => answers.importance.essentials,
  set: (value) => {
    if (value) answers.importance.essentials = value
  },
})

const crime = computed<Importance | null>({
  get: () => answers.importance.crime,
  set: (value) => {
    if (value) answers.importance.crime = value
  },
})

// back to whichever language screen they came through
const back = computed(() => ({
  name: answers.communityLanguage === 'none' ? 'community-language' : 'community',
}))
</script>

<template>
  <StepLayout
    :step="4"
    :back="back"
    :next-label="t('steps.seeSuburbs')"
    @next="router.push({ name: 'results' })"
  >
    <h1 class="priorities__title">{{ t('priorities.title') }}</h1>

    <RadioGroup
      id="essentials-importance"
      v-model="essentials"
      :options="options"
      :legend="t('priorities.essentials')"
      :hint="t('priorities.essentialsHint')"
      legend-tag="h2"
    />

    <RadioGroup
      id="crime-importance"
      v-model="crime"
      :options="options"
      :legend="t('priorities.crime')"
      :hint="t('priorities.crimeHint')"
      legend-tag="h2"
    />
  </StepLayout>
</template>

<style scoped>
.priorities__title {
  margin-bottom: 1.25rem;
}
</style>
