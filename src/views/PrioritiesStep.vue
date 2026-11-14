<script setup lang="ts">
import { computed, h, type FunctionalComponent, type WritableComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { BookOpen, Circle, CircleSlash, GraduationCap, Heart, School } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { PRIORITY_TOPICS, topicInfo } from '@/data/topics'
import type { ChoiceOption, Importance, RatedTopic, SchoolNeed } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* step 4. the rest of the scoring module's topics, each with the same three
   choices as language community (US 2.2). budget fit isn't one of them,
   suburbs within budget always come first. schools ask which kind the
   family needs (US 4.1). reported crime starts at Not important and says why,
   because crime figures can stigmatise the suburbs new arrivals already live
   in (ethics canvas) */

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()

// an empty circle, a heart, a filled heart: the three steps read without words
const HeartFilled: FunctionalComponent = (_, { attrs }) =>
  h(Heart, { ...attrs, fill: 'currentColor' })

const options = computed<ChoiceOption<Importance>[]>(() => [
  { value: 'not', label: t('importance.not'), icon: Circle },
  { value: 'important', label: t('importance.important'), icon: Heart },
  { value: 'very', label: t('importance.very'), icon: HeartFilled },
])

const schoolOptions = computed<ChoiceOption<SchoolNeed>[]>(() => [
  { value: 'primary', label: t('priorities.primary'), icon: School },
  { value: 'secondary', label: t('priorities.secondary'), icon: GraduationCap },
  { value: 'both', label: t('priorities.bothSchools'), icon: BookOpen },
  { value: 'none', label: t('priorities.noSchools'), icon: CircleSlash },
])

const topics = PRIORITY_TOPICS.map((id) => topicInfo(id))

const models = Object.fromEntries(
  PRIORITY_TOPICS.map((topic) => [
    topic,
    computed<Importance | null>({
      get: () => answers.importance[topic],
      set: (value) => {
        if (value) answers.importance[topic] = value
      },
    }),
  ]),
) as Record<RatedTopic, WritableComputedRef<Importance | null>>

const schoolNeed = computed<SchoolNeed | null>({
  get: () => answers.schoolNeed,
  set: (value) => {
    if (value) answers.schoolNeed = value
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
    <p class="priorities__lead">{{ t('priorities.lead') }}</p>

    <div v-for="topic in topics" :key="topic.id" class="priority">
      <RadioGroup
        :id="`importance-${topic.key}`"
        v-model="models[topic.id as RatedTopic].value"
        :options="options"
        :legend="t(`topics.${topic.key}`)"
        :legend-icon="topic.icon"
        :hint="t(`topics.${topic.key}Hint`)"
        legend-tag="h2"
        variant="tile"
        :columns="3"
      />

      <RadioGroup
        v-if="topic.id === 'Education'"
        id="school-need"
        v-model="schoolNeed"
        :options="schoolOptions"
        :legend="t('priorities.schools')"
        :columns="2"
        class="priority__follow-up"
      />
    </div>
  </StepLayout>
</template>

<style scoped>
.priorities__title {
  margin-bottom: 0.5rem;
}

.priorities__lead {
  margin-bottom: 1.25rem;
}

.priority {
  padding-block: 0.25rem 1rem;
  border-bottom: 1px solid var(--nr-line);
}

.priority:last-child {
  border-bottom: 0;
}

.priority__follow-up {
  margin-top: 1rem;
}
</style>
