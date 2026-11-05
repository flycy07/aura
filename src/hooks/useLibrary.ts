import { useCallback, useEffect, useRef, useState } from 'react'
import { allPlaylists, allTracks, deleteTrack, putPlaylist, putTrack } from '../lib/db'
import { extractAccent } from '../lib/colors'
import { guessFromFileName } from '../lib/format'
import { readTags } from '../lib/tags'
import type { Playlist, PlaylistVideo, StoredTrack, Track } from '../lib/types'

const AUDIO_EXTENSIONS = /\.(mp3|m4a|m4b|aac|flac|wav|aiff?|ogg|oga|opus|weba)$/i

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name)
}

function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio()
    let timer = 0
    const finish = (value: number) => {
      window.clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(url)
      resolve(value)
    }
    timer = window.setTimeout(() => finish(0), 6000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : 0)
    audio.onerror = () => finish(0)
    audio.src = url
  })
}

async function buildTrack(file: File): Promise<StoredTrack> {
  const [tags, duration] = await Promise.all([readTags(file), probeDuration(file)])
  const guess = guessFromFileName(file.name)
  const artColor = tags.art ? await extractAccent(tags.art) : undefined

  return {
    id: crypto.randomUUID(),
    title: tags.title ?? guess.title,
    artist: tags.artist ?? guess.artist,
    album: tags.album ?? 'Singoli',
    year: tags.year,
    trackNo: tags.trackNo,
    duration,
    mime: file.type || 'audio/mpeg',
    size: file.size,
    addedAt: Date.now(),
    fingerprint: `${file.name}:${file.size}`,
    fileName: file.name,
    art: tags.art,
    artColor,
    source: 'local',
    audio: file,
  }
}

export type ImportProgress = { done: number; total: number; failed: number } | null

export function useLibrary() {
  const [stored, setStored] = useState<StoredTrack[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [artUrls, setArtUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<ImportProgress>(null)
  const [error, setError] = useState<string | null>(null)

  const storedRef = useRef<StoredTrack[]>([])
  useEffect(() => {
    storedRef.current = stored
  }, [stored])

  useEffect(() => {
    let cancelled = false
    Promise.all([allTracks(), allPlaylists()])
      .then(([tracks, lists]) => {
        if (cancelled) return
        setStored(tracks)
        // Le playlist create prima dei video YouTube non hanno il campo: lo aggiungiamo qui.
        setPlaylists(lists.map((list) => ({ ...list, videos: list.videos ?? [] })))
      })
      .catch(() => {
        if (!cancelled) setError('La memoria locale non è disponibile in questo browser.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // One object URL per stored cover, revoked as soon as it is no longer needed.
  useEffect(() => {
    setArtUrls((previous) => {
      const next: Record<string, string> = {}
      let changed = false
      const liveIds = new Set(stored.map((track) => track.id))
      for (const [id, url] of Object.entries(previous)) {
        if (!liveIds.has(id)) {
          URL.revokeObjectURL(url)
          changed = true
        } else {
          next[id] = url
        }
      }
      for (const track of stored) {
        if (track.art && !next[track.id]) {
          next[track.id] = URL.createObjectURL(track.art)
          changed = true
        }
      }
      return changed ? next : previous
    })
  }, [stored])

  const urlsRef = useRef<Record<string, string>>({})
  useEffect(() => {
    urlsRef.current = artUrls
  }, [artUrls])
  useEffect(
    () => () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url)
    },
    [],
  )

  const tracks: Track[] = stored.map((track) => ({
    ...track,
    artUrl: artUrls[track.id] ?? track.artUrl,
  }))

  const importFiles = useCallback(async (files: File[]) => {
    const audioFiles = files.filter(isAudioFile)
    if (!audioFiles.length) {
      setError('Nessun file audio riconosciuto in questa selezione.')
      return
    }
    setError(null)
    setImporting({ done: 0, total: audioFiles.length, failed: 0 })

    const existing = new Set(storedRef.current.map((track) => track.fingerprint))
    let done = 0
    let failed = 0

    for (const file of audioFiles) {
      const fingerprint = `${file.name}:${file.size}`
      try {
        if (!existing.has(fingerprint)) {
          const track = await buildTrack(file)
          await putTrack(track)
          existing.add(fingerprint)
          setStored((previous) => [track, ...previous])
        }
      } catch (importError) {
        failed += 1
        console.warn('Import non riuscito', file.name, importError)
      }
      done += 1
      setImporting({ done, total: audioFiles.length, failed })
    }

    setImporting(null)
    if (failed > 0) {
      setError(
        failed === audioFiles.length
          ? 'Non è stato possibile leggere questi file.'
          : `Importati ${audioFiles.length - failed} file, ${failed} non leggibili.`,
      )
    }
  }, [])

  /** Downloads a catalogue stream into the offline library, cover included. */
  const saveRemoteTrack = useCallback(async (track: Track): Promise<boolean> => {
    if (storedRef.current.some((item) => item.id === track.id)) return true
    if (!track.streamUrl) return false
    // Le dirette non hanno un file completo da conservare.
    if (track.source === 'radio') return false

    try {
      const response = await fetch(track.streamUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const audio = await response.blob()
      if (audio.size < 4096) throw new Error('File audio vuoto')

      let art: Blob | undefined
      if (track.artUrl) {
        try {
          const artResponse = await fetch(track.artUrl)
          if (artResponse.ok) art = await artResponse.blob()
        } catch {
          // La copertina è opzionale: il brano resta ascoltabile.
        }
      }
      const artColor = art ? await extractAccent(art) : track.artColor

      const saved: StoredTrack = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        year: track.year,
        trackNo: track.trackNo,
        duration: track.duration,
        artColor,
        audio,
        art,
        size: audio.size,
        addedAt: Date.now(),
        fingerprint: `${track.source ?? 'stream'}:${track.remoteId ?? track.id}`,
        fileName: `${track.artist} - ${track.title}`,
        source: 'audius',
        remoteId: track.remoteId,
      }
      await putTrack(saved)
      setStored((previous) => [saved, ...previous])
      return true
    } catch (downloadError) {
      console.warn('Download non riuscito', downloadError)
      setError(
        'Download non riuscito: il file potrebbe non essere più disponibile sul catalogo. Riprova o scegli un altro brano.',
      )
      return false
    }
  }, [])

  const removeTrack = useCallback(async (id: string) => {
    await deleteTrack(id)
    setStored((previous) => previous.filter((track) => track.id !== id))
    setPlaylists((previous) => {
      const next = previous.map((list) => ({
        ...list,
        trackIds: list.trackIds.filter((trackId) => trackId !== id),
      }))
      for (const list of next) {
        if (list.trackIds.length !== previous.find((p) => p.id === list.id)?.trackIds.length) {
          void putPlaylist(list)
        }
      }
      return next
    })
  }, [])

  const createPlaylist = useCallback(async (name: string) => {
    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Nuova playlist',
      trackIds: [],
      videos: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await putPlaylist(playlist)
    setPlaylists((previous) => [...previous, playlist])
    return playlist
  }, [])

  const toggleTrackInPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    let updated: Playlist | null = null
    setPlaylists((previous) =>
      previous.map((list) => {
        if (list.id !== playlistId) return list
        const has = list.trackIds.includes(trackId)
        updated = {
          ...list,
          trackIds: has
            ? list.trackIds.filter((id) => id !== trackId)
            : [...list.trackIds, trackId],
          updatedAt: Date.now(),
        }
        return updated
      }),
    )
    if (updated) await putPlaylist(updated)
  }, [])

  /** Aggiunge o toglie un video YouTube dalla playlist. */
  const toggleVideoInPlaylist = useCallback(
    async (playlistId: string, video: PlaylistVideo) => {
      let updated: Playlist | null = null
      setPlaylists((previous) =>
        previous.map((list) => {
          if (list.id !== playlistId) return list
          const videos = list.videos ?? []
          const has = videos.some((item) => item.id === video.id)
          updated = {
            ...list,
            videos: has ? videos.filter((item) => item.id !== video.id) : [...videos, video],
            updatedAt: Date.now(),
          }
          return updated
        }),
      )
      if (updated) await putPlaylist(updated)
    },
    [],
  )

  return {
    tracks,
    playlists,
    loading,
    importing,
    error,
    dismissError: () => setError(null),
    importFiles,
    saveRemoteTrack,
    removeTrack,
    createPlaylist,
    toggleTrackInPlaylist,
    toggleVideoInPlaylist,
  }
}
