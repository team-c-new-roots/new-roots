import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { MapData, ScoreRequest } from '@/types/api'
import { fetchResults, ResultsError, type ResultsErrorKind } from '@/services/api'

export type ResultsStatus = 'idle' | 'loading' | 'ready' | 'error'

/* the last response from the scoring API, shared by the results, suburb and
   summary screens so moving between them doesn't ask again. a new request
   only goes out when the answers change */
export const useResultsStore = defineStore('results', () => {
  const status = ref<ResultsStatus>('idle')
  const data = shallowRef<MapData | null>(null)
  const errorKind = ref<ResultsErrorKind | null>(null)
  const requestKey = ref('')
  let controller: AbortController | null = null

  async function load(request: ScoreRequest, force = false) {
    const key = JSON.stringify(request)
    if (!force && key === requestKey.value && status.value !== 'error' && status.value !== 'idle') {
      return
    }

    // answers changed while the last request was out, drop it
    controller?.abort()
    const current = new AbortController()
    controller = current
    requestKey.value = key
    status.value = 'loading'
    errorKind.value = null

    try {
      const result = await fetchResults(request, current.signal)
      if (controller !== current) return
      data.value = result
      status.value = 'ready'
    } catch (error) {
      if (controller !== current || (error as Error).name === 'AbortError') return
      errorKind.value = error instanceof ResultsError ? error.kind : 'network'
      status.value = 'error'
    }
  }

  function reset() {
    controller?.abort()
    controller = null
    data.value = null
    status.value = 'idle'
    errorKind.value = null
    requestKey.value = ''
  }

  return { status, data, errorKind, load, reset }
})
