import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

/* how the site looks, not what anyone told us. memory only, same as the
   answers, so nothing is left on a shared phone.

   theme is the whole site: the brand colours, a dark version on espresso,
   or a high contrast black and white one. it starts on high contrast if
   the phone already asks for more contrast.

   mapContrast only changes the map's five match colours to a colour-blind
   safe ramp. it's separate because the map is the one place where colours
   next to each other carry meaning. choosing the high contrast theme turns
   it on too, and it can still be turned off on its own */

export type Theme = 'default' | 'dark' | 'contrast'

export const THEMES: Theme[] = ['default', 'dark', 'contrast']

export const useDisplayStore = defineStore('display', () => {
  const asked =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-contrast: more)').matches
  const theme = ref<Theme>(asked ? 'contrast' : 'default')
  const mapContrast = ref(Boolean(asked))

  watch(
    theme,
    (value) => {
      if (value === 'contrast') mapContrast.value = true
      if (typeof document === 'undefined') return
      if (value === 'default') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = value
    },
    { immediate: true },
  )

  function setTheme(value: Theme) {
    theme.value = value
  }

  function toggleMapContrast() {
    mapContrast.value = !mapContrast.value
  }

  return { theme, mapContrast, setTheme, toggleMapContrast }
})
