import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function PlayIcon({ size, ...rest }: IconProps) {
  return (
    <svg width={size ?? 24} height={size ?? 24} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path
        d="M8.6 5.3c0-1 1.1-1.6 2-1.1l9 6c.8.6.8 1.7 0 2.2l-9 6c-.9.6-2 0-2-1.1V5.3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function PauseIcon({ size, ...rest }: IconProps) {
  return (
    <svg width={size ?? 24} height={size ?? 24} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <rect x="6.5" y="4.5" width="3.6" height="15" rx="1.8" fill="currentColor" />
      <rect x="13.9" y="4.5" width="3.6" height="15" rx="1.8" fill="currentColor" />
    </svg>
  )
}

export function NextIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 5.6c0-.7.8-1.2 1.5-.8l7.4 4.9c.5.4.5 1.2 0 1.6L7.5 16.2c-.7.4-1.5-.1-1.5-.8V5.6Z" fill="currentColor" stroke="none" />
      <path d="M17.2 5v14" strokeWidth={2.4} />
    </Svg>
  )
}

export function PrevIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 5.6c0-.7-.8-1.2-1.5-.8L9.1 9.7c-.5.4-.5 1.2 0 1.6l7.4 4.9c.7.4 1.5-.1 1.5-.8V5.6Z" fill="currentColor" stroke="none" />
      <path d="M6.8 5v14" strokeWidth={2.4} />
    </Svg>
  )
}

export function ShuffleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17 4.5 20 7.5 17 10.5" />
      <path d="M3.5 7.5h3.2c1.2 0 2.3.6 3 1.6l4.6 6.8c.7 1 1.8 1.6 3 1.6h2.7" />
      <path d="M17 14.5 20 17.5 17 20.5" />
      <path d="M3.5 17.5h3.2c1.2 0 2.3-.6 3-1.6l.9-1.3" />
      <path d="M14.2 9.4l.2-.3c.7-1 1.8-1.6 3-1.6h2.6" />
    </Svg>
  )
}

export function RepeatIcon({ repeatOne, ...props }: IconProps & { repeatOne?: boolean }) {
  return (
    <Svg {...props}>
      <path d="M4.5 12.5V11a4.5 4.5 0 0 1 4.5-4.5h9" />
      <path d="M15.5 4 18 6.5 15.5 9" />
      <path d="M19.5 11.5V13a4.5 4.5 0 0 1-4.5 4.5H6" />
      <path d="M8.5 15 6 17.5 8.5 20" />
      {repeatOne && <path d="M12.2 10.4 11 11.2m0 0v3.4" strokeWidth={1.9} />}
    </Svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9.5 12 15l6-5.5" />
    </Svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.6 15.6 4 4" />
    </Svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.5v13M5.5 12h13" strokeWidth={2} />
    </Svg>
  )
}

export function MusicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18V6.5l9-2v11" />
      <circle cx="6.6" cy="18" r="2.6" />
      <circle cx="15.6" cy="15.5" r="2.6" />
    </Svg>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function QueueIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6.5h10M4 12h10M4 17.5h6" />
      <path d="M17 14.5v4.2" />
      <circle cx="17" cy="12.2" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 7h15M9.5 7V5.4c0-.5.4-.9.9-.9h3.2c.5 0 .9.4.9.9V7" />
      <path d="M6.5 7l.8 11.2c.1 1 1 1.8 2 1.8h5.4c1 0 1.9-.8 2-1.8L17.5 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15.5V3.8M8.4 7.2 12 3.6l3.6 3.6" />
      <path d="M5.5 12.5v6.2c0 .9.7 1.6 1.6 1.6h9.8c.9 0 1.6-.7 1.6-1.6v-6.2" />
    </Svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" strokeWidth={2} />
    </Svg>
  )
}

export function AlbumIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.2" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h9M4 12h9M4 17h6" />
      <path d="M17.5 6.5v6.2" />
      <circle cx="17.5" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function CompassIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7 4.7-2.1Z" />
    </Svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v10.2M8.2 10.6 12 14.4l3.8-3.8" />
      <path d="M5.5 17.5v1c0 .8.7 1.5 1.5 1.5h10c.8 0 1.5-.7 1.5-1.5v-1" />
    </Svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  )
}
