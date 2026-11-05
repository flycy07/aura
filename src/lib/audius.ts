import type { Track } from './types'

const API = 'https://api.audius.co'
const APP_NAME = 'AURA'

type Artwork = {
  '150x150'?: string
  '480x480'?: string
  '1000x1000'?: string
}

type ApiTrack = {
  id: string
  title?: string
  duration?: number
  genre?: string
  mood?: string
  release_date?: string
  playlist_name?: string
  artwork?: Artwork
  user?: { name?: string; handle?: string }
}

function mapTrack(raw: ApiTrack): Track {
  const artist = raw.user?.name?.trim() || (raw.user?.handle ? `@${raw.user.handle}` : 'Audius')
  return {
    id: `audius:${raw.id}`,
    remoteId: raw.id,
    title: raw.title?.trim() || 'Senza titolo',
    artist,
    album: raw.playlist_name?.trim() || raw.genre?.trim() || 'Audius',
    year: raw.release_date?.slice(0, 4),
    duration: raw.duration ?? 0,
    artUrl: raw.artwork?.['480x480'] ?? raw.artwork?.['150x150'],
    streamUrl: `${API}/v1/tracks/${raw.id}/stream?app_name=${APP_NAME}`,
    source: 'audius',
  }
}

async function request(path: string): Promise<Track[]> {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Catalogo non disponibile (${response.status})`)
  const payload = (await response.json()) as { data?: ApiTrack[] }
  const data = Array.isArray(payload.data) ? payload.data : []
  return data.map(mapTrack).filter((track) => Boolean(track.streamUrl))
}

/** Free, ad-free catalogue streamed from Audius. No API key, no account. */
export function trendingTracks(limit = 30): Promise<Track[]> {
  return request(`/v1/tracks/trending?app_name=${APP_NAME}&time=week&limit=${limit}`)
}

export function searchTracks(query: string, limit = 30): Promise<Track[]> {
  return request(
    `/v1/tracks/search?app_name=${APP_NAME}&query=${encodeURIComponent(query)}&limit=${limit}`,
  )
}
