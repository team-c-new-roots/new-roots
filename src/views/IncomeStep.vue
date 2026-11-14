<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Baby,
  Briefcase,
  CalendarDays,
  CircleCheck,
  CirclePlus,
  CircleX,
  Landmark,
  Layers,
  Search,
  User,
  Users,
} from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { CENSUS_NAMES } from '@/data/languages'
import { useLanguageStore } from '@/stores/language'
import { needsCoupleAnswer, parseMoney } from '@/services/budget'
import { MAX_CHILDREN } from '@/services/household'
import type { ChoiceOption, IncomeSource, PaymentType, PayPeriod, YesNo } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import BudgetCard from '@/components/steps/BudgetCard.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'
import CheckboxGroup from '@/components/ui/CheckboxGroup.vue'
import BaseField from '@/components/ui/BaseField.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'

/* step 2. Centrelink payments, work income or both. work income sits beside
   Centrelink because people seeking asylum usually can't get Centrelink and
   have to plan around a wage (US 1.2). the budget updates as they answer
   (US 1.1). payments use real maximum rates, so a couple and family tax
   benefit each need one more answer, and those questions only show when
   they change the figure */

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()
const language = useLanguageStore()

const sourceOptions = computed<ChoiceOption<IncomeSource>[]>(() => [
  { value: 'payments', label: t('income.payments'), icon: Landmark },
  { value: 'work', label: t('income.work'), icon: Briefcase },
  { value: 'both', label: t('income.both'), icon: Layers },
])

const paymentOptions = computed<ChoiceOption<PaymentType>[]>(() => [
  { value: 'parenting', label: t('income.parenting'), icon: Baby },
  { value: 'jobseeker', label: t('income.jobseeker'), icon: Search },
  { value: 'familyTax', label: t('income.familyTax'), icon: Users },
  { value: 'other', label: t('income.other'), icon: CirclePlus },
])

const periodOptions = computed<ChoiceOption<PayPeriod>[]>(() => [
  { value: 'week', label: t('income.week'), icon: CalendarDays },
  { value: 'fortnight', label: t('income.fortnight'), icon: CalendarDays },
  { value: 'month', label: t('income.month'), icon: CalendarDays },
])

const coupleOptions = computed<ChoiceOption<YesNo>[]>(() => [
  { value: 'yes', label: t('income.yes'), icon: Users },
  { value: 'no', label: t('income.no'), icon: User },
])

const yesNoOptions = computed<ChoiceOption<YesNo>[]>(() => [
  { value: 'yes', label: t('income.yes'), icon: CircleCheck },
  { value: 'no', label: t('income.no'), icon: CircleX },
])

const usesPayments = computed(
  () => answers.incomeSource === 'payments' || answers.incomeSource === 'both',
)
const usesWork = computed(() => answers.incomeSource === 'work' || answers.incomeSource === 'both')

const askCouple = computed(() =>
  needsCoupleAnswer({
    source: answers.incomeSource,
    payments: answers.payments,
    otherPaymentFortnight: answers.otherPaymentFortnight,
    wageAmount: answers.wageAmount,
    wagePeriod: answers.wagePeriod,
    adults: answers.adults,
    children: answers.children,
    couple: answers.couple,
    teens: answers.teens,
    youngestUnderFive: answers.youngestUnderFive,
  }),
)
const askFamilyTax = computed(
  () => usesPayments.value && answers.payments.includes('familyTax') && answers.children > 0,
)

// teens can't outnumber the children counted on step 1
const teens = computed({
  get: () => Math.min(answers.teens, answers.children),
  set: (value: number) => {
    answers.teens = value
  },
})

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
    if (answers.payments.includes('familyTax') && answers.children === 0) {
      found['payments-first'] ??= t('income.errors.familyTax')
    }
    if (askCouple.value && answers.couple === null)
      found['couple-first'] = t('income.errors.couple')
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
    answers.communityLanguage = CENSUS_NAMES[language.current.community]
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
        :hint="t('income.paymentsHint')"
        :error="errors['payments-first']"
        legend-tag="h2"
        :columns="2"
      />
      <RadioGroup
        v-if="askCouple"
        id="couple"
        v-model="answers.couple"
        :options="coupleOptions"
        :legend="t('income.couple')"
        :hint="t('income.coupleHint')"
        :error="errors['couple-first']"
        legend-tag="h2"
        :columns="2"
      />
      <template v-if="askFamilyTax">
        <NumberStepper
          id="teens"
          v-model="teens"
          :label="t('income.teens')"
          :hint="t('income.teensHint')"
          :min="0"
          :max="Math.min(answers.children, MAX_CHILDREN)"
          :add-label="t('income.addTeen')"
          :remove-label="t('income.removeTeen')"
          :value-text="t('units.children', teens)"
        />
        <RadioGroup
          v-if="teens < answers.children"
          id="youngest"
          v-model="answers.youngestUnderFive"
          :options="yesNoOptions"
          :legend="t('income.youngest')"
          legend-tag="h2"
          :columns="2"
        />
      </template>
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
        variant="tile"
        :columns="3"
      />
    </template>

    <BudgetCard :budget="answers.budget" :uses-payments="usesPayments" />
  </StepLayout>
</template>
