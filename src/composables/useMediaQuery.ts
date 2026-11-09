import { onBeforeUnmount, ref } from 'vue'

// true while the media query matches. used where the markup itself changes
// between phone and desktop, not just the styling
export function useMediaQuery(query: string) {
  const list = window.matchMedia(query)
  const matches = ref(list.matches)

  const update = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }

  list.addEventListener('change', update)
  onBeforeUnmount(() => list.removeEventListener('change', update))

  return matches
}
