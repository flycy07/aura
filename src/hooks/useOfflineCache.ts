import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listCache, pruneCache, putCache, touchCache } from '../lib/cache'
import type { Track } from '../lib/types'

/** Tetto di spazio: oltre questo, i brani ascoltati meno di recente vengono rimossi. */
const BUDGET_BYTES = 500 * 1024 * 1024

export function useOfflineCache() {
  const [index, setIndex] = useState<{ id: string; size: number; art?: Blob }[]>([])
  const [usage, setUsage] = useState(0)
  const idsRef = useRef<Set<string>>(new Set())
  const inFlight = useRef<Set<string>>(new Set())
  const urlsRef = useRef<Record<string, string>>({})

  const refresh = useCallback(async () => {
    try {
      const entries = await listCache()
      idsRef.current = new Set(entries.map((entry) => entry.id))
      setIndex(entries.map((entry) => ({ id: entry.id, size: entry.size, art: entry.art })))
      setUsage(entries.reduce((sum, entry) => sum + entry.size, 0))
    } catch {
      // Cache non disponibile (navigazione privata): l'app resta in streaming.
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // URL delle copertine salvate, per non perderle quando sei offline.
  const artUrls = useMemo(() => {
    const next: Record<string, string> = {}
    for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url)
    for (const entry of index) {
      if (entry.art) next[entry.id] = URL.createObjectURL(entry.art)
    }
    urlsRef.current = next
    return next
  }, [index])

  useEffect(
    () => () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url)
    },
    [],
  )

  /**
   * Mette da parte il brano in sottofondo, senza chiedere nulla all'utente.
   * Dirette e anteprime non hanno un file completo da conservare.
   */
  const remember = useCallback(
    async (track: Track) => {
      if (track.audio) return
      if (!track.streamUrl) return
      if (track.source === 'radio') return
      if (idsRef.current.has(track.id) || inFlight.current.has(track.id)) return

      inFlight.current.add(track.id)
      try {
        void touchCache(track.id)
        const response = await fetch(track.streamUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const audio = await response.blob()
        if (audio.size < 8192) return

        let art: Blob | undefined
        if (track.artUrl) {
          try {
            const artResponse = await fetch(track.artUrl)
            if (artResponse.ok) art = await artResponse.blob()
          } catch {
            // copertina opzionale
          }
        }

        await putCache({ id: track.id, audio, art, size: audio.size, lastUsed: Date.now() })
        await pruneCache(BUDGET_BYTES)
        await refresh()
      } catch {
        // Rete assente o file non disponibile: si riproverà al prossimo ascolto.
      } finally {
        inFlight.current.delete(track.id)
      }
    },
    [refresh],
  )

  const cachedIds = useMemo(() => new Set(index.map((entry) => entry.id)), [index])

  return { cachedIds, artUrls, usage, budget: BUDGET_BYTES, remember }
}
