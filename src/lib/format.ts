export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** "01 - Artist - Title.mp3" → sensible artist/title guesses when tags are missing. */
export function guessFromFileName(fileName: string): { title: string; artist: string } {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim()
  const withoutTrackNo = base.replace(/^\s*\d{1,3}\s*[-.)]\s*/, '')
  const parts = withoutTrackNo.split(/\s+-\s+/)
  if (parts.length >= 2) {
    const artist = parts[0].trim()
    const title = parts.slice(1).join(' - ').trim()
    if (artist && title) return { title, artist }
  }
  return { title: withoutTrackNo || fileName, artist: 'Artista sconosciuto' }
}

export function pluralise(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
