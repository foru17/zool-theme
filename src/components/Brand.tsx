/* ZOOL marks, from the official brand kit (paths only, no font dependency). */

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 636 136" className={className} fill="currentColor" aria-hidden="true">
      <path d="M0 0h140v14L21 122h119v14H0v-14L119 14H0z" />
      <path
        fillRule="evenodd"
        d="M211 0h40c39 0 56 22 56 68s-17 68-56 68h-40c-39 0-56-22-56-68S172 0 211 0zm0 14c-29 0-42 16-42 54s13 54 42 54h40c29 0 42-16 42-54s-13-54-42-54z"
      />
      <path
        fillRule="evenodd"
        d="M379 0h40c39 0 56 22 56 68s-17 68-56 68h-40c-39 0-56-22-56-68S340 0 379 0zm0 14c-29 0-42 16-42 54s13 54 42 54h40c29 0 42-16 42-54s-13-54-42-54z"
      />
      <path d="M491 0h14v122h131v14H491z" />
    </svg>
  )
}

/** The two-O symbol. */
export function Symbol({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 224 128" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M42 0h20c30 0 42 18 42 64s-12 64-42 64H42C12 128 0 110 0 64S12 0 42 0zm0 16C23 16 16 27 16 64s7 48 26 48h20c19 0 26-11 26-48s-7-48-26-48zM162 0h20c30 0 42 18 42 64s-12 64-42 64h-20c-30 0-42-18-42-64S132 0 162 0zm0 16c-19 0-26 11-26 48s7 48 26 48h20c19 0 26-11 26-48s-7-48-26-48z"
      />
    </svg>
  )
}
