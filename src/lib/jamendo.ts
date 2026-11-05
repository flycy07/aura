import type { Track } from './types'

const API = 'https://api.jamendo.com/v3.0'
const STORAGE_KEY = 'aura-jamendo-client'

/** Jamendo needs a free client id. It is a public app identifier, not a password. */
export function getJamendoClientId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim()
    if (stored) return stored
  } catch {
    // memoria non disponibile (navigazione privata): si usa la variabile di build
  }
  return (import.meta.env.VITE_JAMENDO_CLIENT_ID ?? '').trim()
}

export function setJamendoClientId(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value.trim())
  } catch {
    // se il browser blocca lo storage la chiave vale solo per questa sessione
  }
}

type ApiTrack = {
  id: string
  name?: string
  duration?: number
  artist_name?: string
  album_name?: string
  album_image?: string
  image?: string
  audio?: string
  audiodownload?: string
  audiodownload_allowed?: boolean
  releasedate?: string
}

type ApiResponse = {
  headers?: { status?: string; code?: number; error_message?: string }
  results?: ApiTrack[]
}

function mapTrack(raw: ApiTrack): Track {
  return {
    id: `jamendo:${raw.id}`,
    remoteId: raw.id,
    title: raw.name?.trim() || 'Senza titolo',
    artist: raw.artist_name?.trim() || 'Jamendo',
    album: raw.album_name?.trim() || 'Jamendo',
    year: raw.releasedate?.slice(0, 4),
    duration: raw.duration ?? 0,
    artUrl: raw.album_image || raw.image,
    streamUrl: raw.audio,
    source: 'jamendo',
  }
}

async function call(params: Record<string, string>): Promise<Track[]> {
  const clientId = getJamendoClientId()
  if (!clientId) throw new Error('Jamendo non configurato')

  const search = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    imagesize: '300',
    audioformat: 'mp32',
    ...params,
  })

  const response = await fetch(`${API}/tracks/?${search.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Jamendo non raggiungibile (${response.status})`)

  const payload = (await response.json()) as ApiResponse
  // Jamendo answers HTTP 200 even when it rejects the request: check the envelope.
  if (payload.headers?.status === 'failed') {
    throw new Error(payload.headers.error_message ?? 'Jamendo ha rifiutato la richiesta')
  }

  return (payload.results ?? []).map(mapTrack).filter((track) => Boolean(track.streamUrl))
}

export function jamendoPopular(limit = 30): Promise<Track[]> {
  return call({ order: 'popularity_month', limit: String(limit) })
}

export function jamendoSearch(query: string, limit = 30): Promise<Track[]> {
  return call({ search: query, limit: String(limit) })
}

/**
 * Jamendo has no country filter. These are the queries measured to return Italian
 * material ("italiana", "canzone italiana" and "italia" return nothing).
 */
export async function jamendoItalian(limit = 30): Promise<Track[]> {
  const perQuery = String(Math.ceil(limit / 2))
  const lists = await Promise.all([
    call({ search: 'italiano', limit: perQuery }).catch(() => []),
    call({ search: 'musica italiana', limit: perQuery }).catch(() => []),
    call({ search: 'pop italiano', limit: perQuery }).catch(() => []),
    call({ tags: 'italian', order: 'popularity_month', limit: perQuery }).catch(() => []),
  ])
  const seen = new Set<string>()
  const merged: Track[] = []
  for (const list of lists) {
    for (const track of list) {
      if (seen.has(track.id)) continue
      seen.add(track.id)
      merged.push(track)
    }
  }
  return merged.slice(0, limit)
}
