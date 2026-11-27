import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { readDisplay, writeDisplay } from '@/services/display'

/* how the site looks, not what anyone told us.

   theme is the whole site: the brand colours, a dark version on espresso,
   or a high contrast black and white one. it starts on high contrast if
   the phone already asks for more contrast.

   mapContrast only changes the map's five match colours to a colour-blind
   safe ramp. it's separate because the map is the one place where colours
   next to each other carry meaning. choosing the high contrast theme turns
   it on too, and it can still be turned off on its own.

   both are kept in this browser every time they change, even with Save off,
   so a refresh doesn't put someone with low vision back on the brand colours
   (Ishara's testing, US 5.4). services/display.ts says why that's fine on a
   shared phone. a choice made here wins over the phone's contrast setting */

export type Theme = 'default' | 'dark' | 'contrast'

export const THEMES: Theme[] = ['default', 'dark', 'contrast']

export const useDisplayStore = defineStore('display', () => {
  const asked =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-contrast: more)').matches
  const kept = readDisplay()
  const last = kept && THEMES.includes(kept.theme as Theme) ? kept : null
  // Save's own copy only fills in when there's nothing here, see stores/saved.ts
  const remembered = last !== null

  const first: Theme = asked ? 'contrast' : 'default'
  const theme = ref<Theme>(last ? (last.theme as Theme) : first)
  const mapContrast = ref(last ? last.mapContrast : Boolean(asked))

  watch(
    theme,
    (value) => {
      if (typeof document === 'undefined') return
      if (value === 'default') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = value
    },
    { immediate: true },
  )

  // not on start up, so nothing is written until someone picks something
  watch([theme, mapContrast], ([value, map]) => writeDisplay({ theme: value, mapContrast: map }))

  // the map colours come on when someone moves to high contrast, here rather
  // than in the watcher, so a kept choice of high contrast with the map
  // colours off stays that way after a refresh
  function setTheme(value: Theme) {
    if (value === 'contrast' && theme.value !== 'contrast') mapContrast.value = true
    theme.value = value
  }

  function toggleMapContrast() {
    mapContrast.value = !mapContrast.value
  }

  return { theme, mapContrast, remembered, setTheme, toggleMapContrast }
})
