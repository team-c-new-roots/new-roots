<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CircleSlash, MessageCircle, Search } from '@lucide/vue'
import { useAnswersStore } from '@/stores/answers'
import { useFormat } from '@/composables/useFormat'
import { CENSUS_NAMES, COMMUNITY_LANGUAGES, COMMUNITY_NATIVE } from '@/data/languages'
import { loadLanguageIndex } from '@/services/appData'
import type { ChoiceOption } from '@/types'
import type { LanguageIndexEntry } from '@/types/scoring'
import StepLayout from '@/components/steps/StepLayout.vue'
import RadioGroup from '@/components/ui/RadioGroup.vue'

/* step 3, first half. only asked when the language screen didn't already
   tell us. the six quick picks are the communities New Roots is built for,
   each in its own script first. everything else comes from the census data:
   a search over every language spoken in these suburbs, loaded when this step
   opens. "My language isn't listed" is a real answer, not an error, and just
   means community drops out of the ranking */

const { t } = useI18n()
const { whole } = useFormat()
const router = useRouter()
const answers = useAnswersStore()

// short words match too many languages to be useful
const MIN_QUERY = 2
const MAX_MATCHES = 8

const quickPicks = computed<ChoiceOption<string>[]>(() =>
  COMMUNITY_LANGUAGES.map((code) => ({
    value: CENSUS_NAMES[code],
    label: COMMUNITY_NATIVE[code].text,
    lang: COMMUNITY_NATIVE[code].lang,
    dir: COMMUNITY_NATIVE[code].dir,
    hint: t(`languages.${code}`),
    icon: MessageCircle,
  })),
)
const quickNames = computed(() => new Set(quickPicks.value.map((option) => option.value)))

const noneOption = computed<ChoiceOption<string>[]>(() => [
  { value: 'none', label: t('communityLanguage.notListed'), icon: CircleSlash },
])

const index = ref<LanguageIndexEntry[]>([])
const indexState = ref<'loading' | 'ready' | 'error'>('loading')

async function loadIndex() {
  indexState.value = 'loading'
  try {
    index.value = await loadLanguageIndex()
    indexState.value = 'ready'
  } catch {
    indexState.value = 'error'
  }
}
onMounted(loadIndex)

const query = ref('')

// lower case without accents, so "maori" finds Māori
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const folded = computed(() => fold(query.value))

const matches = computed(() => {
  if (folded.value.length < MIN_QUERY) return []
  return (
    index.value
      .map((entry) => {
        const label = fold(entry.label)
        const name = fold(entry.name)
        const starts = label.startsWith(folded.value) || name.startsWith(folded.value)
        const found = starts || label.includes(folded.value) || name.includes(folded.value)
        return { entry, found, starts }
      })
      .filter((item) => item.found)
      // names that start with what was typed first, then the most spoken
      .sort((a, b) => Number(b.starts) - Number(a.starts) || b.entry.speakers - a.entry.speakers)
      .map((item) => item.entry)
  )
})

function toOption(entry: LanguageIndexEntry): ChoiceOption<string> {
  return {
    value: entry.name,
    label: entry.label,
    hint: t('communityLanguage.speakers', { count: whole(entry.speakers) }),
    icon: MessageCircle,
  }
}

// a language picked from the search stays on screen after the search is cleared
const searchOptions = computed<ChoiceOption<string>[]>(() => {
  const chosen = answers.communityLanguage
  const shown = matches.value.slice(0, MAX_MATCHES)
  if (chosen && chosen !== 'none' && !quickNames.value.has(chosen)) {
    const entry = index.value.find((item) => item.name === chosen)
    if (entry && !shown.includes(entry)) shown.unshift(entry)
  }
  return shown.map(toOption)
})

const status = computed(() => {
  if (indexState.value === 'loading') return t('communityLanguage.loading')
  if (folded.value.length < MIN_QUERY) return ''
  if (matches.value.length === 0) return t('communityLanguage.noMatches')
  if (matches.value.length > MAX_MATCHES) {
    return t('communityLanguage.manyMatches', { shown: MAX_MATCHES, count: matches.value.length })
  }
  return t('communityLanguage.matches', { count: matches.value.length }, matches.value.length)
})

// one answer whichever list it came from. the search keeps the data's own
// name for the language so later screens can show it back
const choice = computed<string | null>({
  get: () => answers.communityLanguage,
  set: (value) => {
    answers.communityLanguage = value
    const entry = index.value.find((item) => item.name === value)
    answers.communityLanguageLabel =
      value && value !== 'none' && !quickNames.value.has(value) ? (entry?.label ?? null) : null
  },
})

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
      v-model="choice"
      :options="quickPicks"
      :legend="t('communityLanguage.title')"
      :hint="t('communityLanguage.hint')"
      :error="errors['community-language-first']"
      legend-tag="h1"
    />

    <section class="language-search" aria-labelledby="language-search-heading">
      <h2 id="language-search-heading" class="language-search__heading">
        {{ t('communityLanguage.searchHeading') }}
      </h2>
      <div class="field">
        <label for="language-search" class="field__label">
          {{ t('communityLanguage.searchLabel') }}
        </label>
        <p id="language-search-hint" class="field__hint">
          {{ t('communityLanguage.searchHint', { count: index.length || '' }) }}
        </p>
        <div class="field__control language-search__control">
          <Search class="language-search__icon" :size="20" aria-hidden="true" />
          <input
            id="language-search"
            v-model="query"
            class="field__input"
            type="search"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
            :disabled="indexState === 'error'"
            aria-describedby="language-search-hint language-search-status"
            aria-controls="language-matches"
          />
        </div>
      </div>

      <p id="language-search-status" class="language-search__status" aria-live="polite">
        {{ status }}
      </p>
      <p v-if="indexState === 'error'" class="note">
        {{ t('communityLanguage.loadError') }}
        <button type="button" class="link-action" @click="loadIndex">
          {{ t('results.retry') }}
        </button>
      </p>

      <div id="language-matches">
        <RadioGroup
          v-if="searchOptions.length"
          id="language-match"
          v-model="choice"
          :options="searchOptions"
          :legend="t('communityLanguage.matchesLegend')"
          legend-hidden
        />
      </div>
    </section>

    <RadioGroup
      id="language-none"
      v-model="choice"
      :options="noneOption"
      :legend="t('communityLanguage.noneLegend')"
      legend-hidden
    />
    <p v-if="answers.communityLanguage === 'none'" class="note" aria-live="polite">
      {{ t('communityLanguage.notListedNote') }}
    </p>
  </StepLayout>
</template>

<style scoped>
.language-search {
  margin-block: 1.75rem 0.5rem;
}

.language-search__heading {
  margin: 0 0 0.75rem;
  color: var(--nr-wine);
  font-size: 1.25rem;
}

.language-search__control {
  max-width: 28rem;
  align-items: center;
}

.language-search__icon {
  margin-inline-start: 0.85rem;
  color: var(--nr-ink-muted);
  flex: none;
}

.language-search__status {
  min-height: 1.5em;
  margin: -0.5rem 0 0.75rem;
  color: var(--nr-ink-muted);
}
</style>
