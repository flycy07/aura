import type { Tab } from '../lib/types'
import { AlbumIcon, CompassIcon, ListIcon, MusicIcon } from './Icons'

const TABS: { id: Tab; label: string; icon: typeof MusicIcon }[] = [
  { id: 'discover', label: 'Scopri', icon: CompassIcon },
  { id: 'tracks', label: 'Brani', icon: MusicIcon },
  { id: 'albums', label: 'Album', icon: AlbumIcon },
  { id: 'playlists', label: 'Playlist', icon: ListIcon },
]

type Props = { active: Tab; onChange: (tab: Tab) => void }

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tabbar glass glass--thick" aria-label="Sezioni">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`tabbar__item ${active === id ? 'is-active' : ''}`}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon size={21} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
