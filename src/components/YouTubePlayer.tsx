import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

type PlayerInstance = {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  destroy: () => void
}

type PlayerEvent = { target: PlayerInstance; data?: number }

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: Record<string, unknown>) => PlayerInstance
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

export type YouTubePlayerHandle = {
  play: () => void
  pause: () => void
  seekTo: (seconds: number) => void
  getTime: () => number
  getDuration: () => number
}

let apiPromise: Promise<void> | null = null

/** Carica l'IFrame Player API una sola volta per sessione. */
function loadIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise

  apiPromise = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    )
    if (existing) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('Player YouTube non caricato'))
    document.head.appendChild(script)
  })

  return apiPromise
}

function explain(code: number): string {
  if (code === 101 || code === 150) return 'L’autore ha disattivato l’incorporamento di questo video.'
  if (code === 100) return 'Video rimosso o privato.'
  if (code === 2) return 'Indirizzo del video non valido.'
  return 'YouTube non riesce a riprodurre questo video qui.'
}

type Props = {
  videoId: string
  title: string
  /** Riquadro a tutta larghezza (schermata player) invece del widget compatto. */
  full?: boolean
  /** Il video è finito: la sessione può passare al successivo. */
  onEnded?: () => void
  /** Stato play/pausa reale del player ufficiale (anche se messo in pausa da YouTube). */
  onPlayStateChange?: (playing: boolean) => void
}

/**
 * Player ufficiale incorporato. Resta visibile (nessuna copertura) e usa
 * l'origine della pagina, così YouTube non rifiuta la riproduzione.
 */
export const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  { videoId, title, full, onEnded, onPlayStateChange },
  ref,
) {
  const host = useRef<HTMLDivElement | null>(null)
  const player = useRef<PlayerInstance | null>(null)
  const [error, setError] = useState<number | null>(null)

  // Le callback cambiano a ogni render: stanno in ref così il player non si ricrea.
  const endedRef = useRef(onEnded)
  endedRef.current = onEnded
  const stateRef = useRef(onPlayStateChange)
  stateRef.current = onPlayStateChange

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        try {
          player.current?.playVideo()
        } catch {
          // player non pronto
        }
      },
      pause: () => {
        try {
          player.current?.pauseVideo()
        } catch {
          // player non pronto
        }
      },
      seekTo: (seconds: number) => {
        try {
          player.current?.seekTo(seconds, true)
        } catch {
          // player non pronto
        }
      },
      getTime: () => {
        try {
          return player.current?.getCurrentTime() ?? 0
        } catch {
          return 0
        }
      },
      getDuration: () => {
        try {
          return player.current?.getDuration() ?? 0
        } catch {
          return 0
        }
      },
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    setError(null)

    const start = async () => {
      try {
        await loadIframeApi()
      } catch {
        if (!cancelled) setError(-1)
        return
      }
      if (cancelled || !host.current) return

      host.current.innerHTML = ''
      const mount = document.createElement('div')
      host.current.appendChild(mount)

      player.current = new window.YT!.Player(mount, {
        videoId,
        title,
        width: '100%',
        height: '100%',
        playerVars: {
          origin: window.location.origin,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: PlayerEvent) => {
            try {
              event.target.playVideo()
            } catch {
              // Autoplay bloccato: l'utente tocca play nel player.
            }
          },
          onStateChange: (event: PlayerEvent) => {
            // 0 = finito, 1 = in riproduzione, 2 = in pausa.
            if (event.data === 0) {
              stateRef.current?.(false)
              endedRef.current?.()
            } else if (event.data === 1) {
              stateRef.current?.(true)
            } else if (event.data === 2) {
              stateRef.current?.(false)
            }
          },
          onError: (event: PlayerEvent) => {
            setError(event.data ?? -1)
          },
        },
      })
    }

    void start()

    return () => {
      cancelled = true
      try {
        player.current?.destroy()
      } catch {
        // già smontato
      }
      player.current = null
      if (host.current) host.current.innerHTML = ''
    }
  }, [title, videoId])

  return (
    <div className={`yt__frame ${full ? 'yt__frame--full' : ''}`}>
      <div ref={host} className="yt__mount" />
      {error !== null && (
        <div className="yt__fallback">
          <p>{explain(error)}</p>
          <a
            className="ghost-btn"
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noreferrer"
          >
            Apri su YouTube
          </a>
        </div>
      )}
    </div>
  )
})
