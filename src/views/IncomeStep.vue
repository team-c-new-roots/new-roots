<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Baby,
  Briefcase,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CirclePlus,
  CircleSlash,
  CircleX,
  Info,
  Landmark,
  Layers,
  Search,
  User,
  Users,
} from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { CENSUS_NAMES } from '@/data/languages'
import { useLanguageStore } from '@/stores/language'
import { bothPartnersOnParenting, needsCoupleAnswer, parseMoney } from '@/services/budget'
import { MAX_CHILDREN } from '@/services/household'
import type { AdultPayment, ChoiceOption, IncomeSource, PayPeriod, YesNo } from '@/types'
import StepLayout from '@/components/steps/StepLayout.vue'
import BudgetCard from '@/components/steps/BudgetCard.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'
import BaseField from '@/components/ui/BaseField.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'

/* step 2. Centrelink payments, work income or both. work income sits beside
   Centrelink because people seeking asylum usually can't get Centrelink and
   have to plan around a wage (US 1.2). the budget updates as they answer
   (US 1.1). payments use real maximum rates, so a couple and family tax
   benefit each need one more answer, and those questions only show when
   they change the figure.

   each adult on step 1 gets their own row, since people in one household
   often get different payments. a person can only get one main payment, so
   each row is one choice. family tax benefit is paid for the children, so
   it's asked once. parenting payment and family tax benefit only show once
   step 1 has children, with a line saying so when there are none.

   help for pay that changes week to week opens under the pay question
   rather than sitting in a hover tooltip, which phones can't show */

const { t } = useI18n()
const router = useRouter()
const answers = useAnswersStore()
const language = useLanguageStore()

const sourceOptions = computed<ChoiceOption<IncomeSource>[]>(() => [
  { value: 'payments', label: t('income.payments'), icon: Landmark },
  { value: 'work', label: t('income.work'), icon: Briefcase },
  { value: 'both', label: t('income.both'), icon: Layers },
])

const paymentOptions = computed<ChoiceOption<AdultPayment>[]>(() => [
  ...(answers.children > 0
    ? [{ value: 'parenting' as const, label: t('income.parenting'), icon: Baby }]
    : []),
  { value: 'jobseeker', label: t('income.jobseeker'), icon: Search },
  { value: 'other', label: t('income.otherPayment'), icon: CirclePlus },
  { value: 'none', label: t('income.noPayment'), icon: CircleSlash },
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
  needsCoupleAnswer({ source: answers.incomeSource, adults: answers.adults }),
)

const several = computed(() => answers.adults > 1)
const askFamilyTax = computed(() => usesPayments.value && answers.children > 0)

// "Adult 2" when there's more than one, so every question says who it's about
function adultName(index: number) {
  return t('income.adultN', { n: index + 1 })
}

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
const otherTexts = ref(answers.incomes.map((income) => income.otherFortnight?.toString() ?? ''))
const wageText = ref(answers.wageAmount?.toString() ?? '')
function setOther(index: number, text: string) {
  otherTexts.value[index] = text
  const income = answers.incomes[index]
  if (income) income.otherFortnight = parseMoney(text)
}
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
    if (askCouple.value && answers.couple === null)
      found['couple-first'] = t('income.errors.couple')
    answers.incomes.forEach((income, index) => {
      const n = index + 1
      if (income.payment === null) {
        found[`adult-${n}-first`] = several.value
          ? t('income.errors.adultPayment', { n })
          : t('income.errors.yourPayment')
      } else if (income.payment === 'other' && income.otherFortnight === null) {
        found[`adult-${n}-other`] = several.value
          ? t('income.errors.adultOther', { n })
          : t('income.errors.other')
      }
    })
    if (bothPartnersOnParenting(answers)) found['adult-2-first'] ??= t('income.errors.twoParenting')
    if (askFamilyTax.value && answers.familyTax === null) {
      found['family-tax-first'] = t('income.errors.familyTax')
    }
    const answered = answers.incomes.every((income) => income.payment !== null)
    const gets = answers.incomes.some((income) => income.payment !== 'none')
    if (answered && !gets && answers.familyTax !== 'yes' && !found['family-tax-first']) {
      found['adult-1-first'] = t('income.errors.noPayments')
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
    answers.communityLanguage = CENSUS_NAMES[language.current.community]
  }
  router.push({ name: answers.censusLanguage ? 'community' : 'community-language' })
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

      <div v-if="several" class="income__adults-head">
        <h2 class="legend-heading">{{ t('income.eachAdult') }}</h2>
        <p class="field__hint">{{ t('income.eachAdultHint') }}</p>
      </div>
      <template v-for="(income, index) in answers.incomes" :key="index">
        <RadioGroup
          :id="`adult-${index + 1}`"
          v-model="income.payment"
          :options="paymentOptions"
          :legend="several ? adultName(index) : t('income.yourPayment')"
          :hint="several ? undefined : t('income.paymentHint')"
          :error="errors[`adult-${index + 1}-first`]"
          :legend-tag="several ? 'span' : 'h2'"
          :columns="2"
        />
        <BaseField
          v-if="income.payment === 'other'"
          :id="`adult-${index + 1}-other`"
          :model-value="otherTexts[index] ?? ''"
          :label="
            several ? t('income.adultOtherAmount', { n: index + 1 }) : t('income.otherAmount')
          "
          :hint="t('income.otherHint')"
          :error="errors[`adult-${index + 1}-other`]"
          prefix="$"
          inputmode="decimal"
          @update:model-value="(text: string) => setOther(index, text)"
        />
      </template>
      <p v-if="answers.children === 0" class="note income__child-note">
        {{ t('income.childPaymentsNote') }}
      </p>

      <template v-if="askFamilyTax">
        <RadioGroup
          id="family-tax"
          v-model="answers.familyTax"
          :options="yesNoOptions"
          :legend="t('income.familyTaxQuestion')"
          :hint="t('income.familyTaxHint')"
          :error="errors['family-tax-first']"
          legend-tag="h2"
          :columns="2"
        />
      </template>
      <template v-if="askFamilyTax && answers.familyTax === 'yes'">
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
      <details class="pay-help">
        <summary>
          <Info :size="20" aria-hidden="true" />
          <span>{{ t('income.payChanges') }}</span>
          <ChevronDown class="pay-help__chevron" :size="20" aria-hidden="true" />
        </summary>
        <p>{{ t('income.payChangesBody') }}</p>
      </details>
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

<style scoped>
.income__adults-head {
  margin-bottom: 0.75rem;
}

.income__adults-head .field__hint {
  margin-bottom: 0;
}

.income__child-note {
  margin-top: -0.5rem;
}

/* opens in place, so it works with a tap, a keyboard or a screen reader */
.pay-help {
  margin: -0.5rem 0 1.5rem;
}

.pay-help summary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--nr-target);
  color: var(--nr-wine);
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}

.pay-help summary::-webkit-details-marker {
  display: none;
}

.pay-help summary span {
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.pay-help summary svg {
  flex: none;
  color: var(--nr-rust);
}

.pay-help__chevron {
  transition: transform 0.15s ease;
}

.pay-help[open] .pay-help__chevron {
  transform: rotate(180deg);
}

.pay-help p {
  max-width: 36rem;
  margin: 0.25rem 0 0;
  padding: 0.85rem 1rem;
  border-inline-start: 4px solid var(--nr-orange);
  border-radius: var(--nr-radius-sm);
  background: var(--nr-panel);
}

@media (prefers-reduced-motion: reduce) {
  .pay-help__chevron {
    transition: none;
  }
}
</style>
