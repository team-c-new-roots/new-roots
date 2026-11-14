<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { BedDouble, Building2, House, LayoutGrid } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { MAX_ADULTS, MAX_BEDROOMS, MAX_CHILDREN } from '@/services/household'
import type { ChoiceOption, HomeType } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* step 1. who lives there, then bedrooms and home type, which start from a
   suggestion (US 2.1). every answer has a default, so nothing here can fail.
   every option carries an icon so it reads without much English (US 5.1) */

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()

const bedroomOptions = computed<ChoiceOption<number>[]>(() =>
  Array.from({ length: MAX_BEDROOMS }, (_, index) => {
    const value = index + 1
    return value === MAX_BEDROOMS
      ? { value, label: t('household.fivePlus'), icon: BedDouble }
      : { value, label: String(value), icon: BedDouble }
  }),
)

const homeOptions = computed<ChoiceOption<HomeType>[]>(() => [
  { value: 'house', label: t('household.house'), icon: House },
  { value: 'flat', label: t('household.flat'), icon: Building2 },
  { value: 'either', label: t('household.either'), icon: LayoutGrid },
])

const bedrooms = computed<number | null>({
  get: () => answers.bedrooms,
  set: (value) => {
    if (value !== null) answers.bedrooms = value
  },
})

const homeType = computed<HomeType | null>({
  get: () => answers.homeType,
  set: (value) => {
    if (value) answers.homeType = value
  },
})

const suggestion = computed(() =>
  t('household.suggestion', {
    bedrooms: t('units.bedrooms', answers.suggestedBedrooms),
    people: t('units.people', answers.people),
  }),
)
</script>

<template>
  <StepLayout :step="1" :back="{ name: 'intro' }" @next="router.push({ name: 'income' })">
    <h1>{{ t('household.title') }}</h1>
    <p class="lead">{{ t('household.lead') }}</p>

    <NumberStepper
      id="adults"
      v-model="answers.adults"
      :label="t('household.adults')"
      :hint="t('household.adultsHint')"
      :min="1"
      :max="MAX_ADULTS"
      :add-label="t('household.addAdult')"
      :remove-label="t('household.removeAdult')"
      :value-text="t('units.adults', answers.adults)"
    />
    <NumberStepper
      id="children"
      v-model="answers.children"
      :label="t('household.children')"
      :hint="t('household.childrenHint')"
      :min="0"
      :max="MAX_CHILDREN"
      :add-label="t('household.addChild')"
      :remove-label="t('household.removeChild')"
      :value-text="t('units.children', answers.children)"
    />

    <RadioGroup
      id="bedrooms"
      v-model="bedrooms"
      :options="bedroomOptions"
      :legend="t('household.bedrooms')"
      legend-tag="h2"
      variant="tile"
    />
    <p class="note household__suggestion" aria-live="polite">{{ suggestion }}</p>

    <RadioGroup
      id="home-type"
      v-model="homeType"
      :options="homeOptions"
      :legend="t('household.homeType')"
      legend-tag="h2"
    />
  </StepLayout>
</template>

<style scoped>
.household__suggestion {
  margin-top: -0.75rem;
  margin-bottom: 1.5rem;
}
</style>
