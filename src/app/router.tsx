import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

const EVENT = 'zool:navigate'
const scrollPositions = new Map<string, number>()

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

const subscribe = (l: () => void) => {
  window.addEventListener('popstate', l)
  window.addEventListener(EVENT, l)
  return () => {
    window.removeEventListener('popstate', l)
    window.removeEventListener(EVENT, l)
  }
}

export const usePathname = () =>
  useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => '/',
  )

export function navigate(to: string, { replace = false } = {}) {
  if (to === window.location.pathname + window.location.search) return
  scrollPositions.set(window.location.pathname, window.scrollY)
  history[replace ? 'replaceState' : 'pushState'](null, '', to)
  window.dispatchEvent(new Event(EVENT))
  window.scrollTo({ top: 0 })
}

window.addEventListener('popstate', () => {
  const y = scrollPositions.get(window.location.pathname) ?? 0
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })))
})

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (rest.target && rest.target !== '_self') return
    e.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handle} {...rest} />
}
