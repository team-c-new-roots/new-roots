<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useLanguageStore } from '@/stores/language'
import { GREETINGS, type AppLanguageCode } from '@/data/languages'
import type { ChoiceOption } from '@/types'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* the first screen. each language is written in its own script with the
   English name under it (US-1), so people can find theirs before reading
   any English. picking one applies straight away */

const { t } = useI18n()
const router = useRouter()
const language = useLanguageStore()
const showMore = ref(false)

const options = computed<ChoiceOption<AppLanguageCode>[]>(() =>
  language.options.map((option) => ({
    value: option.code,
    label: option.nativeName,
    hint: option.code === 'en-AU' ? undefined : t(option.nameKey),
    lang: option.code,
    dir: option.dir,
  })),
)

const choice = computed<AppLanguageCode | null>({
  get: () => language.code,
  set: (code) => {
    if (code) language.choose(code)
  },
})
</script>

<template>
  <div class="page page--narrow language-page">
    <p class="language-page__greeting">
      <span
        v-for="(line, row) in GREETINGS"
        :key="row"
        class="language-page__greeting-line"
        :dir="row === 0 ? 'ltr' : 'rtl'"
      >
        <template v-for="(greeting, index) in line" :key="greeting.text">
          <span :lang="greeting.lang" :dir="greeting.dir">{{ greeting.text }}</span>
          <span v-if="index < line.length - 1" aria-hidden="true"> · </span>
        </template>
      </span>
    </p>

    <RadioGroup
      id="app-language"
      v-model="choice"
      :options="options"
      :legend="t('languagePage.heading')"
      :hint="t('languagePage.lead')"
      legend-tag="h1"
      variant="language"
    />

    <button
      type="button"
      class="btn btn--outline"
      :aria-expanded="showMore ? 'true' : 'false'"
      aria-controls="more-languages"
      @click="showMore = !showMore"
    >
      {{ t('languagePage.more') }}
    </button>
    <div v-show="showMore" id="more-languages" class="panel language-page__more">
      <p>{{ t('languagePage.moreBody') }}</p>
      <RouterLink :to="{ name: 'support' }">{{ t('languagePage.support') }}</RouterLink>
    </div>

    <button
      type="button"
      class="btn btn--accent btn--block language-page__continue"
      @click="router.push({ name: 'intro' })"
    >
      {{ t('languagePage.continue') }}
    </button>
    <p class="note language-page__note">{{ t('languagePage.changeAnytime') }}</p>
  </div>
</template>

<style scoped>
.language-page {
  text-align: center;
}

.language-page__greeting {
  color: var(--nr-rust);
  font-size: 1.125rem;
}

.language-page__greeting-line {
  display: block;
}

/* the group is centred like the wireframe, but its options keep their own alignment */
.language-page :deep(legend) {
  width: 100%;
}

.language-page :deep(.field__hint) {
  color: var(--nr-ink);
  font-size: 1.0625rem;
}

.language-page__more {
  margin-top: 1rem;
  text-align: start;
}

.language-page__continue {
  margin-top: 1.75rem;
}

.language-page__note {
  margin-top: 1rem;
}
</style>
