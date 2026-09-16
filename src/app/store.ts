import { useMemo, useSyncExternalStore } from 'react'
import adapter from '@adapter'
import type { ConnectionStatus, HistoryPoint, NodeInfo, Session, SiteInfo, Snapshot } from '@/core/model'
import { DEFAULT_SETTINGS, normalizeSettings, type ThemeSettings } from '@/core/settings'
import { blindNow, noteFrame, type BlindWindow } from '@/core/live'
import { cleanSnapshot } from '@/core/condition'

export { adapter }

export interface State {
  phase: 'loading' | 'ready' | 'error'
  site: SiteInfo | null
  settings: ThemeSettings
  nodes: NodeInfo[]
  snapshots: Record<string, Snapshot>
  session: Session
  connection: ConnectionStatus
  /**
   * At least one live frame has arrived. Until then a node with no snapshot is waiting, not
   * offline: showing every machine as down for the second it takes the socket to answer is
   * a false alarm.
   */
  fed: boolean
  /** A forced refresh is running; cleared by its first frame. */
  refreshing: boolean
  /** Bumps whenever the live buffers change, so charts can re-read them. */
  liveVersion: number
}

let state: State = {
  phase: 'loading',
  site: null,
  settings: DEFAULT_SETTINGS,
  nodes: [],
  snapshots: {},
  session: { loggedIn: false },
  connection: 'connecting',
  fed: false,
  refreshing: false,
  liveVersion: 0,
}

const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const getState = () => state

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
    () => selector(state),
  )
}

/* ---------- live buffer: what the node page charts in "Live" mode ---------- */

const LIVE_CAPACITY = 450 // 15 minutes at a 2 s cadence
const live = new Map<string, HistoryPoint[]>()

export const getLive = (id: string) => live.get(id) ?? []

/**
 * Frames arrive about every two seconds. Four times that with nothing means we stopped
 * seeing the fleet — a closed socket, a backgrounded tab that stopped asking, a sleeping
 * machine — and none of those are the node's fault.
 */
const BLIND_GAP_MS = 8_000

let blindWindows: BlindWindow[] = []
let lastFrameAt: number | null = null

export const getBlindWindows = (): readonly BlindWindow[] => blindNow(blindWindows, lastFrameAt, Date.now(), BLIND_GAP_MS)

function pushLive(snapshots: Record<string, Snapshot>) {
  let changed = false
  const receivedAt = Date.now()
  for (const [id, s] of Object.entries(snapshots)) {
    if (!s.online) continue
    const buf = live.get(id) ?? []
    // Stamp with our own clock: the instruments plot against Date.now(), and a server whose
    // clock is a minute off would otherwise leave a permanent hole at one end of the window.
    const at = receivedAt
    // Same report arriving twice (a retry, a reconnect) must not become two points.
    if (buf.length && (buf[buf.length - 1].at >= at || buf[buf.length - 1].reportedAt === s.at)) continue
    buf.push({
      at,
      reportedAt: s.at,
      cpu: s.cpu,
      memUsed: s.memUsed,
      swapUsed: s.swapUsed,
      diskUsed: s.diskUsed,
      netUp: s.netUp,
      netDown: s.netDown,
      load1: s.load1,
      tcp: s.tcp,
      udp: s.udp,
      process: s.process,
    })
    if (buf.length > LIVE_CAPACITY) buf.splice(0, buf.length - LIVE_CAPACITY)
    live.set(id, buf)
    changed = true
  }
  return changed
}

/* ---------- lifecycle ---------- */

const sameNodes = (a: NodeInfo[], b: NodeInfo[]) =>
  a.length === b.length && a.every((n, i) => n.id === b[i].id && n.name === b[i].name && n.groups.join() === b[i].groups.join())

let unsubscribe: (() => void) | null = null
let refreshTimer: ReturnType<typeof setTimeout> | undefined

const load = async () => {
  const [site, nodes] = await Promise.all([adapter.loadSite(), adapter.loadNodes()])
  set({ site, nodes, settings: normalizeSettings(site.settings), phase: 'ready' })
  adapter.loadSession().then((session) => set({ session }))
}

function connect() {
  unsubscribe?.()
  unsubscribe = adapter.subscribe(
    (event) => {
      const receivedAt = Date.now()
      blindWindows = noteFrame(blindWindows, lastFrameAt, receivedAt, BLIND_GAP_MS)
      lastFrameAt = receivedAt
      // Frames carry the whole fleet. A node that was reporting and is now missing from one has
      // gone offline: keep its last readings and report time, and say so.
      const snapshots: Record<string, Snapshot> = {}
      for (const [id, prev] of Object.entries(state.snapshots)) snapshots[id] = prev.online ? { ...prev, online: false } : prev
      for (const [id, s] of Object.entries(event.snapshots)) snapshots[id] = cleanSnapshot(s)
      const patch: Partial<State> = { snapshots, fed: true, refreshing: false }
      if (event.nodes && !sameNodes(event.nodes, state.nodes)) patch.nodes = event.nodes
      if (pushLive(event.snapshots)) patch.liveVersion = state.liveVersion + 1
      clearTimeout(refreshTimer)
      set(patch)
    },
    (connection) => set({ connection }),
  )
}

export async function start() {
  set({ phase: 'loading' })
  try {
    await load()
  } catch (err) {
    console.error('[zool-theme] failed to load', err)
    set({ phase: 'error' })
    return
  }
  connect()
}

/**
 * Reload the node list and reopen the live connection without leaving the page, so scroll
 * position, filters and the snapshots already on screen stay put. Ends with the first new frame,
 * or after ten seconds, whichever comes first; a failed load keeps what is shown.
 */
export async function refresh() {
  if (state.refreshing || state.phase !== 'ready') return
  set({ refreshing: true })
  refreshTimer = setTimeout(() => set({ refreshing: false }), 10_000)
  unsubscribe?.()
  unsubscribe = null
  adapter.reset?.()
  await load().catch((err) => console.error('[zool-theme] refresh failed', err))
  connect()
}

/** Nodes after the "hidden nodes" setting; memoised so selectors stay stable. */
export function useVisibleNodes() {
  const nodes = useStore((s) => s.nodes)
  const hiddenNodes = useStore((s) => s.settings.hiddenNodes)
  return useMemo(() => {
    const hidden = new Set(hiddenNodes)
    return hidden.size ? nodes.filter((n) => !hidden.has(n.id)) : nodes
  }, [nodes, hiddenNodes])
}
