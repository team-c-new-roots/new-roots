import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { APP_LANGUAGES, findAppLanguage, type AppLanguageCode } from '@/data/languages'
import { applyLocale, isTranslated } from '@/i18n'

// held in memory like everything else. a saved language would tell the next
// person on a shared phone something about the last one
export const useLanguageStore = defineStore('language', () => {
  const code = ref<AppLanguageCode>('en-AU')
  const noticeDismissed = ref(false)

  const current = computed(() => findAppLanguage(code.value))
  const translated = computed(() => isTranslated(code.value))
  // any language but English gets a notice: machine translated, or not ready
  // yet so the page stays in English
  const showNotice = computed(() => code.value !== 'en-AU' && !noticeDismissed.value)
  const main = APP_LANGUAGES.filter((language) => language.group === 'main')
  const more = APP_LANGUAGES.filter((language) => language.group === 'more')

  async function choose(next: AppLanguageCode) {
    code.value = next
    noticeDismissed.value = false
    const language = findAppLanguage(next)
    if (isTranslated(next)) await applyLocale(next, language.dir)
    else await applyLocale('en-AU', 'ltr')
  }

  function dismissNotice() {
    noticeDismissed.value = true
  }

  return {
    code,
    current,
    translated,
    showNotice,
    options: APP_LANGUAGES,
    main,
    more,
    choose,
    dismissNotice,
  }
})
