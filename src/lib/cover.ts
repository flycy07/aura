export type CoverInfo = {
  title: string
  artist: string
  album?: string
  artUrl?: string
}

const NOISE = /\([^()]*\b(?:official|video|audio|lyric|lyrics|hd|hq|4k|visualizer|remaster|remastered|performance|live)\b[^()]*\)|\[[^\[\]]*\b(?:official|video|audio|lyric|lyrics|hd|hq|4k|visualizer|remaster|remastered|performance|live)\b[^\[\]]*\]/gi

/**
 * I titoli dei video sono pieni di “(Official Video)”, “[Lyric Video]”, “| 4K”:
 * per cercare la copertina giusta serve il nome del brano e basta.
 */
export function cleanVideoTitle(raw: string): string {
  return raw
    .replace(NOISE, ' ')
    .replace(/\s*[|·]\s*[^|·]*\b(?:official|video|audio|lyric|lyrics|hd|hq|4k|visualizer|remaster|remastered)\b[^|·]*$/i, '')
    .replace(/\s+[-–—]\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Copertina ufficiale del brano dall'Apple Music/iTunes Store: è l'unica ricerca
 * dei grandi cataloghi che risponde al browser senza proxy (Deezer non manda il
 * CORS, e servirebbe un server che faccia da tramite).
 */
export async function lookupCover(term: string): Promise<CoverInfo | null> {
  const query = term.trim()
  if (!query) return null
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`,
    )
    if (!response.ok) return null
    const payload = (await response.json()) as {
      results?: {
        trackName?: string
        artistName?: string
        collectionName?: string
        artworkUrl100?: string
      }[]
    }
    const hit = payload.results?.[0]
    if (!hit) return null
    return {
      title: hit.trackName?.trim() || query,
      artist: hit.artistName?.trim() || '',
      album: hit.collectionName?.trim(),
      // Apple serve 100×100 di default: la stessa immagine esiste a 600×600.
      artUrl: hit.artworkUrl100?.replace('100x100', '600x600'),
    }
  } catch {
    // Rete assente o servizio giù: si continua con la grafica già disponibile.
    return null
  }
}
