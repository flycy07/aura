import type { Track } from './types'

const API = 'https://de1.api.radio-browser.info'

type Station = {
  stationuuid: string
  name?: string
  url?: string
  url_resolved?: string
  favicon?: string
  tags?: string
  country?: string
  countrycode?: string
  codec?: string
  bitrate?: number
}

// Un'app servita in HTTPS non può riprodurre stream HTTP: il browser li blocca
// come contenuto misto. Teniamo solo le stazioni già in HTTPS.
const MUSIC_TAGS = [
  'pop',
  'hits',
  'top 40',
  'rap',
  'hip hop',
  'hip-hop',
  'trap',
  'dance',
  'rock',
  'music',
  'musica',
  'indie',
  'r&b',
  'house',
  'latin',
]

function mapStation(raw: Station): Track | null {
  const stream = (raw.url_resolved || raw.url || '').trim()
  if (!stream.startsWith('https://')) return null
  const tags = (raw.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  const label = tags.slice(0, 2).join(' · ') || raw.country || 'Radio'
  const favicon = raw.favicon?.startsWith('https://') ? raw.favicon : undefined

  return {
    id: `radio:${raw.stationuuid}`,
    remoteId: raw.stationuuid,
    title: (raw.name ?? '').trim() || 'Radio senza nome',
    artist: 'Radio in diretta',
    album: label,
    duration: 0,
    artUrl: favicon,
    streamUrl: stream,
    source: 'radio',
  }
}

async function request(params: Record<string, string>): Promise<Station[]> {
  const search = new URLSearchParams({ hidebroken: 'true', limit: '80', ...params })
  const response = await fetch(`${API}/json/stations/search?${search.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Radio non raggiungibili (${response.status})`)
  return (await response.json()) as Station[]
}

function toTracks(stations: Station[]): Track[] {
  return stations
    .map(mapStation)
    .filter((track): track is Track => Boolean(track))
}

/** Le stazioni italiane più votate che trasmettono musica (non solo notizie). */
export async function popularItalianStations(): Promise<Track[]> {
  const stations = await request({
    countrycode: 'IT',
    order: 'votes',
    reverse: 'true',
    limit: '120',
  })
  const music = stations.filter((station) => {
    const tags = (station.tags ?? '').toLowerCase()
    if (!tags) return true
    if (/(news|talk|sport|politic|religio)/.test(tags)) return false
    return MUSIC_TAGS.some((tag) => tags.includes(tag)) || true
  })
  return toTracks(music).slice(0, 40)
}

export async function searchStations(query: string): Promise<Track[]> {
  const name = await request({ name: query.trim(), countrycode: 'IT', order: 'votes', reverse: 'true' })
  const byName = toTracks(name)
  if (byName.length) return byName.slice(0, 40)
  const byTag = await request({ tag: query.trim().toLowerCase(), order: 'votes', reverse: 'true' })
  return toTracks(byTag).slice(0, 40)
}
