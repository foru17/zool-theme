import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Native <dialog> as a modal: focus trapping, Escape and the top layer come for free.
 * Clicking the backdrop closes it.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  className = '',
  children,
}: {
  open: boolean
  onClose: () => void
  labelledBy?: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      // Tailwind's preflight zeroes <dialog> margins; `m-auto` restores centring.
      className={`m-auto max-h-[calc(100dvh-40px)] w-[min(440px,calc(100%-40px))] overflow-visible rounded-[24px] border border-line bg-surface p-0 text-ink shadow-pop ${className}`}
    >
      {open && children}
    </dialog>
  )
}
