<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAnswersStore } from '@/stores/answers'
import { useLanguageStore } from '@/stores/language'
import { parseMoney } from '@/services/budget'
import type { ChoiceOption, IncomeSource, PaymentType, PayPeriod } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import BudgetCard from '@/components/steps/BudgetCard.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'
import CheckboxGroup from '@/components/ui/CheckboxGroup.vue'
import BaseField from '@/components/ui/BaseField.vue'

/* step 2. Centrelink payments, work income or both. work income sits beside
   Centrelink because people seeking asylum usually can't get Centrelink and
   have to plan around a wage (US-6). the budget updates as they answer (US-2) */

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()
const language = useLanguageStore()

const sourceOptions = computed<ChoiceOption<IncomeSource>[]>(() => [
  { value: 'payments', label: t('income.payments') },
  { value: 'work', label: t('income.work') },
  { value: 'both', label: t('income.both') },
])

const paymentOptions = computed<ChoiceOption<PaymentType>[]>(() => [
  { value: 'parenting', label: t('income.parenting') },
  { value: 'jobseeker', label: t('income.jobseeker') },
  { value: 'familyTax', label: t('income.familyTax') },
  { value: 'other', label: t('income.other') },
])

const periodOptions = computed<ChoiceOption<PayPeriod>[]>(() => [
  { value: 'week', label: t('income.week') },
  { value: 'fortnight', label: t('income.fortnight') },
  { value: 'month', label: t('income.month') },
])

const usesPayments = computed(
  () => answers.incomeSource === 'payments' || answers.incomeSource === 'both',
)
const usesWork = computed(() => answers.incomeSource === 'work' || answers.incomeSource === 'both')

const period = computed<PayPeriod | null>({
  get: () => answers.wagePeriod,
  set: (value) => {
    if (value) answers.wagePeriod = value
  },
})

// the fields hold what was typed, the store holds the number it means
const otherText = ref(answers.otherPaymentFortnight?.toString() ?? '')
const wageText = ref(answers.wageAmount?.toString() ?? '')
watch(otherText, (text) => {
  answers.otherPaymentFortnight = parseMoney(text)
})
watch(wageText, (text) => {
  answers.wageAmount = parseMoney(text)
})

// errors show after Next and clear one by one as they're fixed. a new one,
// like a field that only appeared after answering, waits for the next Next
const shown = ref<string[]>([])
const errors = computed(() =>
  Object.fromEntries(Object.entries(validate()).filter(([key]) => shown.value.includes(key))),
)

function validate(): Record<string, string> {
  const found: Record<string, string> = {}
  if (!answers.incomeSource) found['income-source-first'] = t('income.errors.source')
  if (usesPayments.value) {
    if (answers.payments.length === 0) found['payments-first'] = t('income.errors.payments')
    else if (answers.payments.includes('other') && answers.otherPaymentFortnight === null) {
      found['other-amount'] = t('income.errors.other')
    }
  }
  if (usesWork.value && answers.wageAmount === null) found['wage-amount'] = t('income.errors.wage')
  return found
}

function next() {
  shown.value = Object.keys(validate())
  if (shown.value.length > 0) return

  // someone who chose Dari on the first screen probably speaks Dari at home,
  // so skip asking. they can still change it from the next screen
  if (!answers.communityLanguage && language.current.community) {
    answers.communityLanguage = language.current.community
  }
  const knowsLanguage = answers.communityLanguage && answers.communityLanguage !== 'none'
  router.push({ name: knowsLanguage ? 'community' : 'community-language' })
}
</script>

<template>
  <StepLayout :step="2" :back="{ name: 'household' }" :errors="errors" @next="next">
    <RadioGroup
      id="income-source"
      v-model="answers.incomeSource"
      :options="sourceOptions"
      :legend="t('income.title')"
      :error="errors['income-source-first']"
      legend-tag="h1"
      variant="card"
    />

    <template v-if="usesPayments">
      <CheckboxGroup
        id="payments"
        v-model="answers.payments"
        :options="paymentOptions"
        :legend="t('income.whichPayments')"
        :error="errors['payments-first']"
        legend-tag="h2"
      />
      <BaseField
        v-if="answers.payments.includes('other')"
        id="other-amount"
        v-model="otherText"
        :label="t('income.otherAmount')"
        :hint="t('income.otherHint')"
        :error="errors['other-amount']"
        prefix="$"
        inputmode="decimal"
      />
    </template>

    <template v-if="usesWork">
      <BaseField
        id="wage-amount"
        v-model="wageText"
        :label="t('income.wage')"
        :hint="t('income.wageHint')"
        :error="errors['wage-amount']"
        prefix="$"
        inputmode="decimal"
      />
      <RadioGroup
        id="wage-period"
        v-model="period"
        :options="periodOptions"
        :legend="t('income.period')"
        legend-tag="h2"
      />
    </template>

    <BudgetCard :budget="answers.budget" />
  </StepLayout>
</template>
