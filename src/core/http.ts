export class HttpError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`HTTP ${status}`)
  }
}

export async function request<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
      signal: ctrl.signal,
    })
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      /* keep text */
    }
    if (!res.ok) throw new HttpError(res.status, body)
    return body as T
  } finally {
    clearTimeout(timer)
  }
}

export const wsUrl = (path: string) => {
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${path}`
}

/** A WebSocket that reconnects with capped backoff and pauses while the tab is hidden. */
export function resilientSocket(opts: {
  url: () => string
  onOpen?: (ws: WebSocket) => void
  onMessage: (data: string) => void
  onStatus?: (status: 'connecting' | 'open' | 'closed') => void
  onGiveUp?: () => void
  maxFailures?: number
}) {
  let ws: WebSocket | null = null
  let stopped = false
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const connect = () => {
    if (stopped) return
    opts.onStatus?.('connecting')
    let socket: WebSocket
    try {
      socket = new WebSocket(opts.url())
    } catch {
      // e.g. blocked by CSP or mixed content; keep the retry chain alive.
      failures++
      timer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** Math.min(failures, 4)))
      return
    }
    ws = socket
    let opened = false
    socket.onopen = () => {
      opened = true
      failures = 0
      opts.onStatus?.('open')
      opts.onOpen?.(socket)
    }
    socket.onmessage = (e) => {
      if (typeof e.data === 'string') opts.onMessage(e.data)
    }
    socket.onclose = () => {
      if (ws !== socket) return
      ws = null
      opts.onStatus?.('closed')
      if (stopped) return
      // Count drops after a successful open too, so a flapping server backs off.
      failures++
      if (!opened && opts.maxFailures && failures >= opts.maxFailures) {
        opts.onGiveUp?.()
        return
      }
      const delay = Math.min(15_000, 1000 * 2 ** Math.min(failures, 4))
      timer = setTimeout(connect, delay)
    }
  }

  connect()
  return {
    get socket() {
      return ws
    },
    close() {
      stopped = true
      clearTimeout(timer)
      ws?.close()
      ws = null
    },
  }
}
