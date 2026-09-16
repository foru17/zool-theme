import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/** A button with an anchored panel. Closes on outside click, Escape, or `close()`. */
export function Popover({
  label,
  button,
  buttonClassName = 'icon-btn',
  align = 'end',
  panelClassName = '',
  children,
}: {
  label: string
  button: ReactNode
  buttonClassName?: string
  align?: 'start' | 'end'
  panelClassName?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={id}
        className={buttonClassName}
        onClick={() => setOpen((v) => !v)}
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          className={`popover fade-in absolute top-[calc(100%+8px)] z-40 ${align === 'end' ? 'right-0' : 'left-0'} ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
