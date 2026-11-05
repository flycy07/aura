import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RepeatMode, Track } from '../lib/types'
import { getCachedAudio, isCached } from '../lib/cache'

function shuffleWithFirst(ids: string[], first: string): string[] {
  const rest = ids.filter((id) => id !== first)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return ids.includes(first) ? [first, ...rest] : rest
}

export function useAudioPlayer(tracks: Track[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [queue, setQueue] = useState<string[]>([])
  const [sourceQueue, setSourceQueue] = useState<string[]>([])
  const [index, setIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [volume, setVolumeState] = useState(0.85)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const shouldPlayRef = useRef(false)
  const loadedKeyRef = useRef('none')

  const byId = useMemo(() => {
    const map = new Map<string, Track>()
    for (const track of tracks) map.set(track.id, track)
    return map
  }, [tracks])

  const currentTrackId = index >= 0 ? queue[index] : undefined
  const currentTrack = currentTrackId ? byId.get(currentTrackId) : undefined

  // The load effect reads the freshest track through a ref so a library update
  // (for example saving a stream offline) does not reload the audio element.
  const currentRef = useRef<Track | undefined>(currentTrack)
  currentRef.current = currentTrack

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.volume = 0.85
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  useEffect(() => {
    const audio = getAudio()
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTime = () => setPosition(audio.currentTime)
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onError = () => {
      // La sorgente ha rifiutato il file: 404, CORS, codec non supportato.
      if (!audio.currentSrc && !audio.getAttribute('src')) return
      setPlaybackError(
        'Questo brano non è riproducibile adesso: la sorgente ha rifiutato il file audio.',
      )
    }
    audio.addEventListener('error', onError)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('durationchange', onDuration)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('error', onError)
    }
  }, [getAudio])

  const advance = useCallback(
    (direction: 1 | -1) => {
      setIndex((current) => {
        if (current < 0) return current
        const next = current + direction
        if (next < 0) return queue.length ? queue.length - 1 : current
        if (next >= queue.length) return repeat === 'all' ? 0 : current
        return next
      })
      shouldPlayRef.current = true
    },
    [queue.length, repeat],
  )

  const next = useCallback(() => advance(1), [advance])

  const previous = useCallback(() => {
    const audio = getAudio()
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      setPosition(0)
      return
    }
    advance(-1)
  }, [advance, getAudio])

  const playQueue = useCallback(
    (ids: string[], startId: string) => {
      if (!ids.length) return
      const start = ids.includes(startId) ? startId : ids[0]
      const ordered = shuffle ? shuffleWithFirst(ids, start) : ids
      setSourceQueue(ids)
      setQueue(ordered)
      setIndex(Math.max(0, ordered.indexOf(start)))
      shouldPlayRef.current = true
    },
    [shuffle],
  )

  const playTrack = useCallback(
    (trackId: string, ids?: string[]) => playQueue(ids?.length ? ids : [trackId], trackId),
    [playQueue],
  )

  const togglePlay = useCallback(() => {
    const audio = getAudio()
    if (!currentTrack) return
    if (audio.paused) {
      shouldPlayRef.current = true
      void audio.play().catch(() => setIsPlaying(false))
    } else {
      shouldPlayRef.current = false
      audio.pause()
    }
  }, [currentTrack, getAudio])

  const seek = useCallback(
    (seconds: number) => {
      const audio = getAudio()
      if (!Number.isFinite(audio.duration)) return
      const clamped = Math.min(Math.max(seconds, 0), audio.duration)
      audio.currentTime = clamped
      setPosition(clamped)
    },
    [getAudio],
  )

  const setVolume = useCallback(
    (value: number) => {
      const clamped = Math.min(Math.max(value, 0), 1)
      setVolumeState(clamped)
      getAudio().volume = clamped
    },
    [getAudio],
  )

  const toggleShuffle = useCallback(() => {
    setShuffle((enabled) => {
      const nextEnabled = !enabled
      const currentId = currentTrackId
      setQueue((currentQueue) => {
        if (!currentId) return currentQueue
        const base = sourceQueue.length ? sourceQueue : currentQueue
        const ordered = nextEnabled ? shuffleWithFirst(base, currentId) : base
        setIndex(Math.max(0, ordered.indexOf(currentId)))
        return ordered
      })
      return nextEnabled
    })
  }, [currentTrackId, sourceQueue])

  const jumpTo = useCallback(
    (trackId: string) => {
      const target = queue.indexOf(trackId)
      if (target < 0) return
      setIndex(target)
      shouldPlayRef.current = true
    },
    [queue],
  )

  /**
   * Mette un brano in fondo alla coda senza interrompere quello in ascolto.
   * Restituisce false se era già in coda.
   */
  const enqueue = useCallback(
    (trackId: string) => {
      if (!queue.length) {
        playQueue([trackId], trackId)
        return true
      }
      if (queue.includes(trackId)) return false
      setQueue((current) => [...current, trackId])
      setSourceQueue((current) => (current.includes(trackId) ? current : [...current, trackId]))
      return true
    },
    [playQueue, queue],
  )

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'))
  }, [])

  const loadKey = currentTrack
    ? `${currentTrack.id}::${currentTrack.audio ? 'local' : currentTrack.streamUrl ?? 'none'}`
    : 'none'

  // Ultimo Blob audio agganciato all'elemento: si libera solo dopo aver messo
  // la sorgente nuova, mai prima di averla pronta.
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const audio = getAudio()
    if (!audioRef.current) return
    const track = currentRef.current

    if (!track) {
      audio.pause()
      loadedKeyRef.current = 'none'
      return
    }

    const previousId = loadedKeyRef.current.split('::')[0]
    const sameTrack = previousId === track.id
    const resumeAt = sameTrack ? audio.currentTime : 0
    const keepPlaying = sameTrack ? !audio.paused : shouldPlayRef.current
    let cancelled = false

    const resumeAndPlay = () => {
      if (resumeAt > 0 && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(resumeAt, audio.duration)
      }
      if (keepPlaying) void audio.play().catch(() => setIsPlaying(false))
    }

    const start = async () => {
      let source: string | null = null
      if (track.audio) {
        source = URL.createObjectURL(track.audio)
      } else if (track.source !== 'radio' && (await isCached(track.id))) {
        const cached = await getCachedAudio(track.id)
        if (cancelled) return
        if (cached) source = URL.createObjectURL(cached)
        else if (track.streamUrl) source = track.streamUrl
        else return
      } else if (track.streamUrl) {
        source = track.streamUrl
      } else {
        return
      }

      if (cancelled) {
        if (source.startsWith('blob:')) URL.revokeObjectURL(source)
        return
      }

      setPlaybackError(null)
      audio.src = source
      if (objectUrlRef.current && objectUrlRef.current !== source) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      objectUrlRef.current = source.startsWith('blob:') ? source : null
      setDuration(track.duration || 0)
      setPosition(resumeAt)
      loadedKeyRef.current = loadKey

      // Niente load()/removeAttribute qui: su iOS svuotare l'elemento obbliga a un
      // nuovo tocco per ripartire, ed è il motivo per cui la coda si fermava a
      // fine brano. Cambiare solo la sorgente lascia l'elemento “sbloccato”.
      if (resumeAt > 0) audio.addEventListener('loadedmetadata', resumeAndPlay, { once: true })
      else resumeAndPlay()
    }

    void start()

    return () => {
      cancelled = true
      audio.removeEventListener('loadedmetadata', resumeAndPlay)
    }
  }, [getAudio, loadKey])

  useEffect(() => {
    const audio = getAudio()
    const onEnded = () => {
      if (repeat === 'one') {
        audio.currentTime = 0
        void audio.play().catch(() => setIsPlaying(false))
        return
      }
      const last = index >= queue.length - 1
      if (last && repeat === 'off') {
        shouldPlayRef.current = false
        setPosition(0)
        return
      }
      advance(1)
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [advance, getAudio, index, queue.length, repeat])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    if (!currentTrack) {
      session.metadata = null
      return
    }
    session.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: currentTrack.artUrl
        ? [{ src: currentTrack.artUrl, sizes: '480x480', type: 'image/jpeg' }]
        : [],
    })
    session.setActionHandler('play', () => {
      shouldPlayRef.current = true
      void getAudio().play().catch(() => undefined)
    })
    session.setActionHandler('pause', () => {
      shouldPlayRef.current = false
      getAudio().pause()
    })
    session.setActionHandler('nexttrack', next)
    session.setActionHandler('previoustrack', previous)
    session.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') seek(details.seekTime)
    })
    return () => {
      session.setActionHandler('play', null)
      session.setActionHandler('pause', null)
      session.setActionHandler('nexttrack', null)
      session.setActionHandler('previoustrack', null)
      session.setActionHandler('seekto', null)
    }
  }, [currentTrack, getAudio, next, previous, seek])

  // Con lo schermo spento restano i comandi di sistema: lo stato deve seguirci.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = !currentTrack ? 'none' : isPlaying ? 'playing' : 'paused'
  }, [currentTrack, isPlaying])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return
    if (!('setPositionState' in navigator.mediaSession)) return
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(Math.max(position, 0), duration),
        playbackRate: 1,
      })
    } catch {
      // Alcuni browser rifiutano lo stato mentre il media sta caricando.
    }
  }, [currentTrack, duration, position])

  return {
    currentTrack,
    currentTrackId,
    queue,
    isPlaying,
    position,
    duration,
    volume,
    shuffle,
    repeat,
    playbackError,
    dismissPlaybackError: () => setPlaybackError(null),
    playTrack,
    playQueue,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    jumpTo,
    enqueue,
    cycleRepeat,
  }
}

export type PlayerApi = ReturnType<typeof useAudioPlayer>
