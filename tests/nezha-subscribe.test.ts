import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { nezha } from '../src/adapters/nezha'
import frame from './fixtures/nezha-frame.json'
import groups from './fixtures/nezha-groups.json'
import type { LiveEvent } from '../src/core/model'

/** A socket that opens and delivers one recorded frame on the next tick. */
class FakeSocket {
  static OPEN = 1
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  constructor() {
    setTimeout(() => {
      this.onopen?.()
      this.onmessage?.({ data: JSON.stringify(frame) })
    }, 0)
  }
  send() {}
  close() {}
}

beforeAll(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { location: { protocol: 'https:', host: 'status.test' }, ZoolConfig: {} })
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('fetch', async (url: string) =>
    new Response(JSON.stringify(url.includes('server-group') ? groups : { success: true, data: {} }), { status: 200 }),
  )
})

afterAll(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('keeps groups on the first live event after loadNodes (no flicker)', async () => {
  const loading = nezha.loadNodes()
  // Deliver the socket's first frame without waiting for a real event-loop tick.
  await vi.advanceTimersByTimeAsync(0)
  const nodes = await loading
  expect(vi.getTimerCount()).toBe(0)
  const grouped = nodes.filter((n) => n.groups.length).length
  expect(grouped).toBeGreaterThan(10)

  const events: LiveEvent[] = []
  const stop = nezha.subscribe((e) => events.push(e))
  // The hub replays the last frame synchronously on subscribe.
  expect(events.length).toBeGreaterThan(0)
  expect(events[0].nodes!.filter((n) => n.groups.length).length).toBe(grouped)
  stop()
})

it('reset drops the cached frame and socket, so the next load waits for a new frame', async () => {
  const created = vi.fn()
  vi.stubGlobal(
    'WebSocket',
    class extends FakeSocket {
      constructor() {
        super()
        created()
      }
    },
  )
  const fetches = vi.fn()
  vi.stubGlobal('fetch', async (url: string) => {
    fetches(url)
    return new Response(JSON.stringify(url.includes('server-group') ? groups : { success: true, data: {} }), { status: 200 })
  })

  nezha.reset!()
  let settled = false
  const loading = nezha.loadNodes().then((n) => {
    settled = true
    return n
  })
  // Not answered from the old frame: nothing resolves before the new socket delivers.
  await Promise.resolve()
  expect(settled).toBe(false)
  expect(created).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(0)
  const nodes = await loading
  expect(nodes.length).toBeGreaterThan(0)
  // Groups are fetched again rather than served from the previous promise.
  expect(fetches.mock.calls.some(([u]) => String(u).includes('server-group'))).toBe(true)
})
