import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { AppData, MapData, ScoreRequest } from '@/types/scoring'
import { DataError, loadAppData, toMapData, type DataErrorKind } from '@/services/appData'
import { scoreSuburbs } from '@/services/scoring'

export type ResultsStatus = 'idle' | 'loading' | 'ready' | 'error'

/* the household's ranking, shared by the results, suburb and summary screens.
   the suburb data loads once, then every change of answer re-ranks straight
   away on the phone, with nothing sent anywhere */
export const useResultsStore = defineStore('results', () => {
  const status = ref<ResultsStatus>('idle')
  const data = shallowRef<MapData | null>(null)
  const errorKind = ref<DataErrorKind | null>(null)
  const requestKey = ref('')
  let appData: AppData | null = null

  async function load(request: ScoreRequest, force = false) {
    const key = JSON.stringify(request)
    if (!force && key === requestKey.value && status.value === 'ready') return
    requestKey.value = key

    if (!appData) {
      status.value = 'loading'
      errorKind.value = null
      try {
        appData = await loadAppData()
      } catch (error) {
        if (requestKey.value !== key) return
        errorKind.value = error instanceof DataError ? error.kind : 'network'
        status.value = 'error'
        return
      }
      // the answers changed while the file was loading, the newer call ranks
      if (requestKey.value !== key) return
    }

    data.value = toMapData(appData, scoreSuburbs(appData, request), request.selected_language)
    status.value = 'ready'
  }

  // the suburb data isn't personal, so it stays loaded. only the ranking goes
  function reset() {
    data.value = null
    status.value = 'idle'
    errorKind.value = null
    requestKey.value = ''
  }

  return { status, data, errorKind, load, reset }
})
