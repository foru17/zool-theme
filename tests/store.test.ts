import { afterEach, describe, expect, it, vi } from 'vitest'

type Listener = (event: { snapshots: Record<string, unknown>; nodes?: unknown[] }) => void

const fake = vi.hoisted(() => {
  const node = (id: string) => ({ id, name: id, groups: [], weight: 0 })
  const f = {
    listeners: [] as Listener[],
    unsubscribed: 0,
    resets: 0,
    loads: 0,
    nodes: [node('a')],
    failNextLoad: false,
    node,
  }
  return f
})

vi.mock('@adapter', () => ({
  default: {
    target: 'demo',
    capabilities: {},
    loadSite: async () => ({ name: 'x', description: '', settings: {}, recordHours: 0, oauth: false, passwordLogin: true }),
    loadNodes: async () => {
      fake.loads++
      if (fake.failNextLoad) {
        fake.failNextLoad = false
        throw new Error('offline')
      }
      return fake.nodes
    },
    loadSession: async () => ({ loggedIn: false }),
    subscribe: (l: Listener) => {
      fake.listeners.push(l)
      return () => {
        fake.unsubscribed++
        fake.listeners = fake.listeners.filter((x) => x !== l)
      }
    },
    reset: () => {
      fake.resets++
    },
  },
}))

const snap = { online: true, at: 1, cpu: 1, memUsed: 0, memTotal: 0, swapUsed: 0, swapTotal: 0, diskUsed: 0, diskTotal: 0, netUp: 0, netDown: 0, totalUp: 0, totalDown: 0, load1: 0, uptime: 0, tcp: 0, udp: 0, process: 0 }
const emit = (id = 'a') => fake.listeners.forEach((l) => l({ snapshots: { [id]: snap } }))

afterEach(() => {
  vi.useRealTimers()
})

describe('store: fed and refresh', () => {
  it('is not fed until the first live frame, then is', async () => {
    const { start, getState } = await import('../src/app/store')
    await start()
    expect(getState().phase).toBe('ready')
    expect(getState().fed).toBe(false)
    emit()
    expect(getState().fed).toBe(true)
    expect(getState().snapshots.a).toBeTruthy()
  })

  it('refresh reloads nodes, resets the adapter, resubscribes and keeps snapshots', async () => {
    const { refresh, getState } = await import('../src/app/store')
    const before = { loads: fake.loads, resets: fake.resets, unsub: fake.unsubscribed }
    fake.nodes = [fake.node('a'), fake.node('b')]
    const running = refresh()
    expect(getState().refreshing).toBe(true)
    await running
    expect(fake.loads).toBe(before.loads + 1)
    expect(fake.resets).toBe(before.resets + 1)
    expect(fake.unsubscribed).toBe(before.unsub + 1)
    expect(fake.listeners).toHaveLength(1)
    expect(getState().nodes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(getState().snapshots.a).toBeTruthy()
    expect(getState().fed).toBe(true)
    expect(getState().refreshing).toBe(true)
    emit('b')
    expect(getState().refreshing).toBe(false)
  })

  it('ignores a second refresh while one is running', async () => {
    const { refresh } = await import('../src/app/store')
    const loads = fake.loads
    const first = refresh()
    const second = refresh()
    await Promise.all([first, second])
    expect(fake.loads).toBe(loads + 1)
    emit()
  })

  it('keeps what is shown when the reload fails, and still reconnects', async () => {
    const { refresh, getState } = await import('../src/app/store')
    const nodes = getState().nodes
    fake.failNextLoad = true
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await refresh()
    err.mockRestore()
    expect(getState().nodes).toBe(nodes)
    expect(getState().phase).toBe('ready')
    expect(fake.listeners).toHaveLength(1)
    emit()
    expect(getState().refreshing).toBe(false)
  })

  it('marks a node that drops out of a frame offline and keeps its last readings', async () => {
    const { getState } = await import('../src/app/store')
    fake.listeners.forEach((l) => l({ snapshots: { a: snap, b: snap } }))
    expect(getState().snapshots.b.online).toBe(true)
    fake.listeners.forEach((l) => l({ snapshots: { a: snap } }))
    expect(getState().snapshots.b.online).toBe(false)
    expect(getState().snapshots.b.cpu).toBe(1)
    expect(getState().snapshots.a.online).toBe(true)
  })
})
