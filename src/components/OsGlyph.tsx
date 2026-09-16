import { osKey } from '@/core/os'
import { OS_COLORS } from '@/core/os.manifest'

/**
 * Operating-system marks live in one same-origin sprite (`public/os/sprite.svg`, simple-icons
 * CC0 plus the project's own four-pane Windows shape) rather than in the bundle: 27 marks would
 * add about 25 KB of path data to every page load, and the sprite is fetched once and cached.
 * The version in the address busts that cache when the sprite changes.
 */
const SPRITE = `/os/sprite.svg?v=${__ZOOL_VERSION__}`

/**
 * A distribution mark. With `tile`, it is a square app-style icon: the brand's colour fills a
 * rounded square and the mark sits on it in white or black, whichever reads — so every system
 * gets the same footprint however wide its mark is drawn, and a yellow Linux or a black Apple
 * stays visible on either theme. Without `tile` the bare mark takes `currentColor`.
 */
export function OsGlyph({ os, size = 13, tile, className = '' }: { os: string; size?: number; tile?: number; className?: string }) {
  const key = osKey(os)
  const mark = (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" fill="currentColor" aria-hidden>
      <use href={`${SPRITE}#${key}`} />
    </svg>
  )
  if (!tile) {
    return (
      <span className={`inline-flex shrink-0 ${className}`} data-os={key} role="img" aria-label={os || key}>
        {mark}
      </span>
    )
  }
  return (
    <span
      className={`os-tile grid shrink-0 place-items-center ${className}`}
      style={{ width: tile, height: tile, backgroundColor: OS_COLORS[key]?.tile, color: OS_COLORS[key]?.mark }}
      data-os={key}
      role="img"
      aria-label={os || key}
    >
      {mark}
    </span>
  )
}
