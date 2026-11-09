<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAnswersStore } from '@/stores/answers'
import { COMMUNITY_LANGUAGES } from '@/data/languages'
import type { ChoiceOption, CommunityLanguage } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* step 3, first half. only asked when the language screen didn't already
   tell us. "My language isn't listed" is a real answer, not an error, and it
   just means community drops out of the ranking */

type Answer = CommunityLanguage | 'none'

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()

const options = computed<ChoiceOption<Answer>[]>(() => [
  ...COMMUNITY_LANGUAGES.map((code) => ({ value: code, label: t(`languages.${code}`) })),
  { value: 'none' as const, label: t('communityLanguage.notListed') },
])

const submitted = ref(false)
const errors = computed(() => {
  const found: Record<string, string> = {}
  if (submitted.value && !answers.communityLanguage) {
    found['community-language-first'] = t('communityLanguage.error')
  }
  return found
})

function next() {
  submitted.value = true
  if (!answers.communityLanguage) return
  router.push({ name: answers.communityLanguage === 'none' ? 'priorities' : 'community' })
}
</script>

<template>
  <StepLayout :step="3" :back="{ name: 'income' }" :errors="errors" @next="next">
    <RadioGroup
      id="community-language"
      v-model="answers.communityLanguage"
      :options="options"
      :legend="t('communityLanguage.title')"
      :hint="t('communityLanguage.hint')"
      :error="errors['community-language-first']"
      legend-tag="h1"
    />
    <p v-if="answers.communityLanguage === 'none'" class="note" aria-live="polite">
      {{ t('communityLanguage.notListedNote') }}
    </p>
  </StepLayout>
</template>
