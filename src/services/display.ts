/* US 5.4, the theme stays put. someone with low vision shouldn't have to find
   the theme picker again every time the page reloads, so the theme and the
   map's own high contrast switch are kept in this browser whether or not Save
   is on. it's the one thing kept without asking, because it says nothing
   about the person: no answers, no suburbs, no language. Clear my details
   leaves it alone for the same reason, since it isn't their details.

   whatever comes back is checked, the same as Save, since anything on the
   page could have written to it */

export const DISPLAY_KEY = 'new-roots-display'

export interface DisplayChoice {
  theme: string
  mapContrast: boolean
}

// some browsers block storage outright, private Safari used to throw on write
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

// what was chosen last time, or null if nothing was or it doesn't look right.
// the theme is checked against the real list by the store
export function readDisplay(): DisplayChoice | null {
  const store = storage()
  if (!store) return null
  try {
    const item = store.getItem(DISPLAY_KEY)
    if (item === null) return null
    const raw: unknown = JSON.parse(item)
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
    const { theme, mapContrast } = raw as Record<string, unknown>
    if (typeof theme !== 'string' || theme.length > 20) return null
    return { theme, mapContrast: mapContrast === true }
  } catch {
    return null
  }
}

// quietly does nothing if the browser won't let us, the theme still works
// for this visit
export function writeDisplay(choice: DisplayChoice) {
  try {
    storage()?.setItem(DISPLAY_KEY, JSON.stringify(choice))
  } catch {
    // storage full or blocked
  }
}
