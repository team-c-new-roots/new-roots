import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAnswersStore } from './answers'
import { useDisplayStore, THEMES, type Theme } from './display'
import { useLanguageStore } from './language'
import { APP_LANGUAGES, type AppLanguageCode } from '@/data/languages'
import { readSaved, removeSaved, writeSaved, type SavedState } from '@/services/saved'

/* US 2.7, Save. on: the answers, summary list, language and
   theme are written to this browser every time they change, so a refresh or
   a visit next week picks up where they left off. off, or Clear my details:
   the saved copy is removed straight away. it starts off for everyone.
   the theme is also kept on its own whether Save is on or not, see
   stores/display.ts, so turning Save off doesn't lose it */

export const useSavedStore = defineStore('saved', () => {
  const answers = useAnswersStore()
  const display = useDisplayStore()
  const language = useLanguageStore()

  const on = ref(false)
  // the browser refused, private browsing or storage turned off
  const failed = ref(false)

  function state(): SavedState {
    return {
      answers: answers.snapshot(),
      language: language.code,
      theme: display.theme,
      mapContrast: display.mapContrast,
    }
  }

  function write() {
    if (!on.value) return
    if (!writeSaved(state())) {
      on.value = false
      failed.value = true
    }
  }

  // once at start up, before the router's first guard reads the answers.
  // the language loads its messages, so main.ts waits for it before mounting
  async function load(): Promise<void> {
    const saved = readSaved()
    if (!saved) return
    answers.restore(saved.answers)
    // the display store keeps the theme itself now, even with Save off. this
    // copy only counts for something saved before that, with nothing newer
    if (!display.remembered && THEMES.includes(saved.theme as Theme)) {
      display.setTheme(saved.theme as Theme)
      display.mapContrast = saved.mapContrast
    }
    on.value = true
    // rewrites the date, so the month starts again from this visit
    write()
    const code = APP_LANGUAGES.find((item) => item.code === saved.language)?.code
    if (code && code !== 'en-AU') await language.choose(code as AppLanguageCode)
  }

  function start(): boolean {
    failed.value = false
    on.value = true
    write()
    return on.value
  }

  function stop() {
    on.value = false
    removeSaved()
  }

  function toggle(): boolean {
    if (on.value) {
      stop()
      return true
    }
    return start()
  }

  watch(() => [answers.snapshot(), language.code, display.theme, display.mapContrast], write, {
    deep: true,
  })

  return { on, failed, load, start, stop, toggle }
})
