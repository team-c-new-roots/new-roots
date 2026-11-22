<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { HandHeart, Lock, MapPin, Phone } from '@lucide/vue'
import { useLanguageStore } from '@/stores/language'
import { GREETINGS, type AppLanguage, type AppLanguageCode } from '@/data/languages'
import type { ChoiceOption } from '@/types'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* the first screen, and the landing page. it says who New Roots is for and
   what it does before asking anything (teacher feedback: "why am I here?").
   each language is written in its own script with the English name under
   it (US 5.2), so people can find theirs before reading much English.
   picking one applies straight away. Continue stays in view on a phone,
   since the language list can push it below the fold */

const { t } = useI18n()
const router = useRouter()
const language = useLanguageStore()
// open already if the language in use is one of the extra ones
const showMore = ref(language.current.group === 'more')

const toOption = (option: AppLanguage): ChoiceOption<AppLanguageCode> => ({
  value: option.code,
  label: option.nativeName,
  // the name in the page's language, skipped when it's the same word as the label
  hint:
    option.code === 'en-AU' || t(option.nameKey) === option.nativeName
      ? undefined
      : t(option.nameKey),
  lang: option.code,
  dir: option.dir,
})
const options = computed(() => language.main.map(toOption))
const moreOptions = computed(() => language.more.map(toOption))

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

    <h1 class="language-page__title">{{ t('languagePage.purpose') }}</h1>
    <p class="language-page__lead">{{ t('languagePage.who') }}</p>
    <ul class="language-page__points">
      <li>
        <HandHeart :size="20" aria-hidden="true" />
        {{ t('languagePage.free') }}
      </li>
      <li>
        <Lock :size="20" aria-hidden="true" />
        {{ t('languagePage.private') }}
      </li>
      <li>
        <MapPin :size="20" aria-hidden="true" />
        {{ t('languagePage.melbourne') }}
      </li>
    </ul>

    <RadioGroup
      id="app-language"
      v-model="choice"
      :options="options"
      :legend="t('languagePage.heading')"
      :hint="t('languagePage.lead')"
      legend-tag="h2"
      variant="language"
    />

    <div class="language-page__continue">
      <button
        type="button"
        class="btn btn--accent btn--block"
        @click="router.push({ name: 'intro' })"
      >
        {{ t('languagePage.continue') }}
      </button>
    </div>
    <p class="note language-page__note">{{ t('languagePage.changeAnytime') }}</p>

    <button
      type="button"
      class="btn btn--outline"
      :aria-expanded="showMore ? 'true' : 'false'"
      aria-controls="more-languages"
      @click="showMore = !showMore"
    >
      {{ t('languagePage.more') }}
    </button>
    <div v-show="showMore" id="more-languages" class="language-page__more">
      <RadioGroup
        id="more-language"
        v-model="choice"
        :options="moreOptions"
        :legend="t('languagePage.moreLegend')"
        legend-tag="h2"
        variant="language"
      />
    </div>

    <section class="panel language-page__not-listed" aria-labelledby="not-listed-title">
      <h2 id="not-listed-title">{{ t('languagePage.notListed') }}</h2>
      <p>{{ t('languagePage.notListedBody') }}</p>
      <p class="language-page__links">
        <a href="tel:131450">
          <Phone :size="18" aria-hidden="true" />
          {{ t('languagePage.callTis') }}
        </a>
        <RouterLink :to="{ name: 'support' }">{{ t('languagePage.support') }}</RouterLink>
      </p>
    </section>
  </div>
</template>

<style scoped>
.language-page {
  text-align: center;
}

.language-page__greeting {
  margin-bottom: 0.5rem;
  color: var(--nr-rust);
  font-size: 1.125rem;
}

.language-page__greeting-line {
  display: block;
}

.language-page__title {
  margin-bottom: 0.5rem;
}

.language-page__lead {
  font-size: 1.0625rem;
}

/* three short promises, in a row when they fit */
.language-page__points {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin: 0 0 1.75rem;
  padding: 0;
  list-style: none;
}

.language-page__points li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.85rem;
  border-radius: var(--nr-radius-pill);
  background: var(--nr-apricot);
  font-size: 0.9375rem;
  font-weight: 700;
}

.language-page__points svg {
  flex: none;
  color: var(--nr-rust);
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
}

/* for anyone whose language isn't listed, always in view under the lists */
.language-page__not-listed {
  margin-top: 1.25rem;
  text-align: start;
}

.language-page__not-listed h2 {
  margin: 0 0 0.35rem;
  color: var(--nr-rust);
  font-size: 1.25rem;
}

.language-page__not-listed p {
  margin: 0;
}

.language-page__not-listed .language-page__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin-top: 0.75rem;
}

.language-page__links a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: var(--nr-target);
  font-weight: 700;
}

/* stuck to the bottom of the screen until the page reaches it, so the next
   step is always in view, on a phone or a short laptop screen */
.language-page__continue {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0.5rem;
  padding-block: 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
  background: var(--nr-surface);
}

.language-page__note {
  margin-top: 0.25rem;
}
</style>
