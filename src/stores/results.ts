import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { AppData, LanguageFile, MapData, ScoreRequest } from '@/types/scoring'
import {
  DataError,
  loadAppData,
  loadLanguage,
  toMapData,
  type DataErrorKind,
} from '@/services/appData'
import { scoreSuburbs } from '@/services/scoring'
import { loadTravel, withTravel } from '@/services/travel'
import { loadAvailability, type AvailabilityFile } from '@/services/availability'

export type ResultsStatus = 'idle' | 'loading' | 'ready' | 'error'

/* the household's ranking, shared by the results, suburb and summary screens.
   the suburb data and the chosen language load once, then every change of
   answer re-ranks straight away on the phone, with nothing sent anywhere */
export const useResultsStore = defineStore('results', () => {
  const status = ref<ResultsStatus>('idle')
  const data = shallowRef<MapData | null>(null)
  const errorKind = ref<DataErrorKind | null>(null)
  const requestKey = ref('')
  // how often homes come up (US 2.5). extra, so the results still show
  // without it and the card just leaves that line out
  const availability = shallowRef<AvailabilityFile | null>(null)

  async function load(request: ScoreRequest, force = false) {
    const key = JSON.stringify(request)
    if (!force && key === requestKey.value && status.value === 'ready') return
    requestKey.value = key

    // both files cache, so after the first load this resolves straight away
    let appData: AppData
    let language: LanguageFile | null = null
    if (status.value !== 'ready') status.value = 'loading'
    errorKind.value = null
    // waited for with the rest, so flagged suburbs don't jump down the list
    // once it arrives. a failed load just leaves the flag off
    const extra = availability.value ? null : loadAvailability().catch(() => null)
    try {
      appData = await loadAppData()
      if (request.selected_language) language = await loadLanguage(request.selected_language)
      // a file for each place they need to get to, added as the Commute topic
      const places = request.key_places ?? []
      if (places.length) {
        const files = await Promise.all(places.map((id) => loadTravel(id)))
        appData = withTravel(
          appData,
          places.map((id, index) => ({ id, file: files[index]! })),
        )
      }
    } catch (error) {
      if (requestKey.value !== key) return
      errorKind.value = error instanceof DataError ? error.kind : 'network'
      status.value = 'error'
      return
    }
    // the answers changed while a file was loading, the newer call ranks
    if (requestKey.value !== key) return

    const file = extra ? await extra : null
    if (requestKey.value !== key) return
    if (file) availability.value = file

    data.value = toMapData(appData, scoreSuburbs(appData, language, request), language)
    status.value = 'ready'
  }

  // the suburb data isn't personal, so it stays loaded. only the ranking goes
  function reset() {
    data.value = null
    status.value = 'idle'
    errorKind.value = null
    requestKey.value = ''
  }

  return { status, data, errorKind, availability, load, reset }
})
