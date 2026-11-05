import type { Track } from '../lib/types'
import { Sheet } from './Sheet'
import { TrackRow } from './TrackRow'

type Props = {
  open: boolean
  onClose: () => void
  queue: Track[]
  currentTrackId?: string
  isPlaying: boolean
  onSelect: (trackId: string) => void
}

export function QueueSheet({ open, onClose, queue, currentTrackId, isPlaying, onSelect }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="In coda">
      {queue.length === 0 ? (
        <p className="sheet__empty">La coda è vuota. Scegli un brano dalla libreria.</p>
      ) : (
        <div className="sheet__list">
          {queue.map((track, index) => (
            <TrackRow
              key={`${track.id}-${index}`}
              track={track}
              index={index + 1}
              active={track.id === currentTrackId}
              playing={isPlaying}
              onPlay={() => {
                onSelect(track.id)
                onClose()
              }}
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}
