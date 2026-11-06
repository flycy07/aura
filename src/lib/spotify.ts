import type { PlaylistVideo, SpotifyTrack } from './types'

/**
 * Da febbraio 2026 la Web API di Spotify restituisce i brani di una playlist
 * solo al proprietario o ai collaboratori: per le playlist pubbliche di altri
 * arrivano nome e copertina, non le tracce. Quindi Aura non finge di leggere il
 * link: salva il link come riferimento e importa la lista incollata a mano.
 * La riproduzione passa dal player YouTube, cercando il brano la prima volta.
 */

export const MAX_TRACKS = 300

const SEPARATOR = /\s+[-–—]\s+/

function hash(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(36)
}

/** `1.`, `01)`, `-`, `•`, righe di intestazione: si scartano o si tolgono. */
function cleanLine(raw: string): string {
  return raw
    .replace(/^\s*(?:\d{1,3}\s*[.)\]:-]\s*|[-•*]\s*)/, '')
    // Le tabulazioni restano: separano artista e titolo nel testo copiato da tabella.
    .replace(/[^\S\t]+/g, ' ')
    .trim()
}

function skipLine(line: string): boolean {
  if (!line) return true
  if (/^(spotify|playlist|brani|tracks?|canzoni|songs?)\b[:\s]*$/i.test(line)) return true
  return false
}

/**
 * Accetta una riga per brano, con le forme che si ottengono copiando da Spotify
 * o da una scaletta: “Artista - Titolo”, “Artista – Titolo”, “Artista<TAB>Titolo”.
 * Con un solo valore la riga è tutta una ricerca.
 */
export function parseTracklist(text: string): SpotifyTrack[] {
  const seen = new Set<string>()
  const tracks: SpotifyTrack[] = []

  for (const raw of text.split(/\r?\n/)) {
    if (tracks.length >= MAX_TRACKS) break
    const line = cleanLine(raw)
    if (skipLine(line)) continue

    let artist = ''
    let title = line
    const parts = line.split(SEPARATOR)
    if (parts.length >= 2) {
      artist = parts[0].trim()
      title = parts.slice(1).join(' - ').trim()
    } else if (line.includes('\t')) {
      const [left, ...rest] = line.split('\t')
      artist = left.trim()
      title = rest.join(' ').trim()
    }
    if (!title) continue

    const key = `${artist}|${title}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    tracks.push({
      id: `sp-${hash(key)}`,
      title,
      artist,
    })
  }

  return tracks
}

/** Testo “Artista Titolo” usato per cercare il brano su YouTube. */
export function spotifyQuery(track: SpotifyTrack): string {
  return `${track.artist} ${track.title}`.trim()
}

/** Branco Spotify già risolto: è un video nella coda YouTube. */
export function toYouTubeVideo(track: SpotifyTrack): PlaylistVideo | null {
  if (!track.videoId) return null
  return {
    id: track.videoId,
    title: track.artist ? `${track.title} · ${track.artist}` : track.title,
    channel: track.artist || 'Spotify',
    seconds: track.seconds ?? 0,
    thumb: track.thumb ?? '',
  }
}

/** Normalizza il link incollato; vuoto se non sembra un link Spotify. */
export function normaliseSpotifyLink(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\/(open|play)\.spotify\.com\//i.test(trimmed)) return trimmed
  if (/^spotify:playlist:[A-Za-z0-9]+$/.test(trimmed)) return trimmed
  return ''
}

export type SpotifyLinkInfo = {
  name: string
  artUrl?: string
}

/**
 * Nome e copertina dal link, con l'oEmbed pubblico di Spotify: risponde anche al
 * browser (CORS `*`) e non chiede credenziali. I brani no: da febbraio 2026 la
 * Web API li restituisce solo al proprietario o ai collaboratori della playlist.
 */
export async function fetchSpotifyLink(input: string): Promise<SpotifyLinkInfo | null> {
  const link = normaliseSpotifyLink(input)
  if (!link) return null
  const url = link.startsWith('spotify:')
    ? `https://open.spotify.com/${link.split(':')[1]}/${link.split(':')[2]}`
    : link
  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
    if (!response.ok) return null
    const payload = (await response.json()) as { title?: string; thumbnail_url?: string }
    const name = payload.title?.trim()
    if (!name) return null
    return { name, artUrl: payload.thumbnail_url }
  } catch {
    return null
  }
}
