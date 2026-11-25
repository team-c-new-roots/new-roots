<script setup lang="ts">
import {
  computed,
  h,
  onMounted,
  ref,
  type FunctionalComponent,
  type WritableComputedRef,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { BookOpen, Circle, CircleSlash, GraduationCap, Heart, School, TramFront } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { PRIORITY_TOPICS, topicInfo } from '@/data/topics'
import { loadAppData } from '@/services/appData'
import { cleanName } from '@/services/results'
import { MAX_PLACES } from '@/services/travel'
import type { ChoiceOption, Importance, RatedTopic, SchoolNeed } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* step 4. the rest of the scoring module's topics, each with the same three
   choices as language community (US 2.2). budget fit isn't one of them,
   suburbs within budget always come first. schools ask which kind the
   family needs (US 4.1). reported crime starts at Not important and says why,
   because crime figures can stigmatise the suburbs new arrivals already live
   in (ethics canvas).

   the five topics share one look (three tiles each) and sit together, and
   the schools question (two by two) has its own section above them, so the
   two kinds of question don't take turns down the page (teacher feedback).
   schools comes first because it's a fact about the family that decides
   what the schools rating counts. it only shows when step 1 has children,
   since schoolNeed is already none without them */

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

/* US 4.2, up to two places they need to get to, picked by suburb so there's
   never an address. optional, so it comes after the ratings everyone answers. the suburb list comes from the same data file the
   results use, which is cached, so it's no extra download later. travel time
   only gets a rating once there's somewhere to travel to */
const suburbs = ref<{ id: string; name: string }[]>([])
const suburbsFailed = ref(false)
onMounted(async () => {
  try {
    const data = await loadAppData()
    suburbs.value = data.suburbs
      .map((row) => ({ id: row.suburb_id, name: cleanName(row.suburb_name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    suburbsFailed.value = true
  }
})

const placeSlots = Array.from({ length: MAX_PLACES }, (_, index) => index)

function placeAt(index: number) {
  return answers.places[index] ?? ''
}

// clearing the first moves the second up, so the list never has a gap
function setPlace(index: number, event: Event) {
  const id = (event.target as HTMLSelectElement).value
  const next = [...answers.places]
  if (id) next[index] = id
  else next.splice(index, 1)
  answers.places = [...new Set(next.filter(Boolean))].slice(0, MAX_PLACES)
}

const commute = computed<Importance | null>({
  get: () => answers.importance.Commute,
  set: (value) => {
    if (value) answers.importance.Commute = value
  },
})

// back to whichever language screen they came through
const back = computed(() => ({
  name: answers.censusLanguage ? 'community' : 'community-language',
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

    <section
      v-if="answers.children > 0"
      class="panel priorities__group priorities__schools"
      aria-labelledby="schools-heading"
    >
      <h2 id="schools-heading" class="priorities__group-title">
        <School :size="24" class="legend-icon" aria-hidden="true" />
        {{ t('priorities.schoolsHeading') }}
      </h2>
      <RadioGroup
        id="school-need"
        v-model="schoolNeed"
        :options="schoolOptions"
        :legend="t('priorities.schools')"
        :hint="t('priorities.schoolsHint')"
        :columns="2"
      />
    </section>

    <section class="priorities__group" aria-labelledby="importance-heading">
      <h2 id="importance-heading" class="priorities__group-title">
        {{ t('priorities.importanceHeading') }}
      </h2>
      <div v-for="topic in topics" :key="topic.id" class="priority">
        <RadioGroup
          :id="`importance-${topic.key}`"
          v-model="models[topic.id as RatedTopic].value"
          :options="options"
          :legend="t(`topics.${topic.key}`)"
          :legend-icon="topic.icon"
          :hint="t(`topics.${topic.key}Hint`)"
          legend-tag="h3"
          variant="tile"
          :columns="3"
        />
      </div>
    </section>

    <section class="panel priorities__group priorities__places" aria-labelledby="places-heading">
      <h2 id="places-heading" class="priorities__group-title">
        <TramFront :size="24" class="legend-icon" aria-hidden="true" />
        {{ t('keyPlaces.heading') }}
      </h2>
      <p id="places-hint" class="field__hint">{{ t('keyPlaces.hint') }}</p>
      <p v-if="suburbsFailed" class="field__error">{{ t('keyPlaces.error') }}</p>
      <div class="priorities__place-fields">
        <div v-for="index in placeSlots" :key="index" class="field">
          <label :for="`place-${index}`" class="field__label">
            {{ t(index === 0 ? 'keyPlaces.first' : 'keyPlaces.second') }}
          </label>
          <select
            :id="`place-${index}`"
            :value="placeAt(index)"
            :disabled="!suburbs.length || (index > 0 && !answers.places.length)"
            aria-describedby="places-hint"
            @change="setPlace(index, $event)"
          >
            <option value="">{{ t('keyPlaces.none') }}</option>
            <option v-for="suburb in suburbs" :key="suburb.id" :value="suburb.id">
              {{ suburb.name }}
            </option>
          </select>
        </div>
      </div>
      <RadioGroup
        v-if="answers.places.length"
        id="importance-commute"
        v-model="commute"
        :options="options"
        :legend="t('topics.commute')"
        :legend-icon="TramFront"
        :hint="t('topics.commuteHint')"
        legend-tag="h3"
        variant="tile"
        :columns="3"
        class="priorities__commute"
      />
    </section>
  </StepLayout>
</template>

<style scoped>
.priorities__places {
  margin-top: 1.5rem;
}

.priorities__place-fields {
  display: grid;
  gap: 0 1rem;
  margin-top: 0.75rem;
}

@media (min-width: 40rem) {
  .priorities__place-fields {
    grid-template-columns: 1fr 1fr;
  }
}

.priorities__commute {
  margin-top: 1rem;
}

/* the same look as the map's Show a suburb list */
.priorities__place-fields select {
  width: 100%;
  min-height: var(--nr-target);
  padding-inline: 0.85rem 2.75rem;
  border: 2px solid var(--nr-border-strong);
  border-radius: var(--nr-radius-sm);
  background-color: var(--nr-surface-raised);
  background-image: var(--nr-select-arrow);
  background-position: right 0.85rem center;
  background-repeat: no-repeat;
  background-size: 1.25rem;
  color: var(--nr-ink);
  font: inherit;
  font-size: 1.0625rem;
  text-overflow: ellipsis;
  appearance: none;
  cursor: pointer;
}

.priorities__place-fields select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

:global([dir='rtl']) .priorities__place-fields select {
  background-position: left 0.85rem center;
}

.priorities__title {
  margin-bottom: 0.5rem;
}

.priorities__lead {
  margin-bottom: 1.25rem;
}

.priorities__group-title {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 1.25rem;
}

.priority {
  padding-block: 0.25rem 1rem;
  border-bottom: 1px solid var(--nr-line);
}

.priority:last-child {
  border-bottom: 0;
}

.priorities__schools {
  margin-bottom: 1.5rem;
}

.priorities__schools :deep(fieldset) {
  margin-bottom: 0;
}

/* white chips on the apricot panel, so the unchosen ones still stand out */
.priorities__schools :deep(.choice__input:not(:checked) + .choice__body) {
  background: var(--nr-surface-raised);
}

.priorities__schools :deep(.choice__input:not(:checked):hover + .choice__body) {
  background: var(--nr-apricot-strong);
}
</style>
