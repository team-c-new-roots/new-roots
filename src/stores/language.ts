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
  // picked a language whose words aren't ready yet, so the page stays in English
  const showNotice = computed(() => !translated.value && !noticeDismissed.value)

  function choose(next: AppLanguageCode) {
    code.value = next
    noticeDismissed.value = false
    const language = findAppLanguage(next)
    if (isTranslated(next)) applyLocale(next, language.dir)
    else applyLocale('en-AU', 'ltr')
  }

  function dismissNotice() {
    noticeDismissed.value = true
  }

  return { code, current, translated, showNotice, options: APP_LANGUAGES, choose, dismissNotice }
})
