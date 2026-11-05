/** La chiave YouTube sta sul server (secret del Worker): qui non c'è nessun segreto. */

import type { PlaylistVideo } from './types'

/** Un risultato YouTube ha la stessa forma di un video salvato in playlist. */
export type YouTubeVideo = PlaylistVideo

const MESSAGES: Record<string, string> = {
  missing_key: 'La chiave YouTube non è configurata sul server.',
  missing_query: 'Scrivi un artista o un brano da cercare.',
  invalid_key: 'Chiave API non valida o YouTube Data API v3 non attivata.',
  quota_exceeded: 'Quota giornaliera di YouTube esaurita: riprova domani.',
  referer_blocked: 'La chiave API rifiuta le richieste da questo sito.',
  forbidden_origin: 'Richiesta bloccata: origine non consentita.',
  rate_limited: 'Troppe ricerche di fila: attendi un minuto.',
  upstream_error: 'YouTube non ha risposto come previsto. Riprova.',
}

export async function searchYouTube(term: string): Promise<YouTubeVideo[]> {
  const query = term.trim()
  if (!query) return []

  const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json' },
  })
  const payload = (await response.json().catch(() => null)) as
    | { videos?: YouTubeVideo[]; error?: string }
    | null

  if (!response.ok) {
    const code = payload?.error ?? ''
    throw new Error(MESSAGES[code] ?? 'Ricerca non disponibile in questo momento.')
  }

  return payload?.videos ?? []
}
