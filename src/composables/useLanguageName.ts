import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnswersStore } from '@/stores/answers'
import { QUICK_PICK_BY_CENSUS } from '@/data/languages'

// the household's language as people should read it: the translated name for
// a quick pick, the data team's display name for anything found by searching
export function useLanguageName() {
  const { t } = useI18n()
  const answers = useAnswersStore()

  return computed(() => {
    const name = answers.censusLanguage
    if (!name) return null
    const key = QUICK_PICK_BY_CENSUS[name]
    return key ? t(`languages.${key}`) : (answers.communityLanguageLabel ?? name)
  })
}
