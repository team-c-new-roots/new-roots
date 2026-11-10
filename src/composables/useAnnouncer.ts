import { ref } from 'vue'

/* a single page app never reloads, so a screen reader isn't told the page
   changed. this string gets rendered into an aria-live region. clearing it
   first matters, setting the same text twice announces nothing */

const message = ref('')

export function useAnnouncer() {
  function announce(text: string) {
    message.value = ''
    window.setTimeout(() => {
      message.value = text
    }, 80)
  }

  return { message, announce }
}
