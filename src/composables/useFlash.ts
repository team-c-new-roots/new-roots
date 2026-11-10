import { ref } from 'vue'

// a one-off message carried to the next screen, like "your details have been
// cleared" after the clear button sends you back to the start. read it once
// and it's gone
const flash = ref<string | null>(null)

export function useFlash() {
  function set(key: string) {
    flash.value = key
  }

  function take(): string | null {
    const key = flash.value
    flash.value = null
    return key
  }

  return { set, take }
}
