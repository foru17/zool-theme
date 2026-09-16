import { request, resilientSocket, wsUrl } from '@/core/http'
import type {
  LiveEvent,
  LoginResult,
  MonitorAdapter,
  NodeInfo,
  PingData,
  Session,
  SiteInfo,
  Snapshot,
} from '@/core/model'
import { flagToRegion } from '@/core/region'

/* ---------- API shapes (Nezha dashboard v1, tested on v2.0.13) ---------- */

interface Common<T> {
  success: boolean
  data?: T
  error?: string
}

export interface NezhaServer {
  id: number
  name: string
  public_note?: string
  display_index?: number
  country_code?: string
  last_active?: string
  host?: {
    platform?: string
    platform_version?: string
    cpu?: string[]
    gpu?: string[]
    mem_total?: number
    disk_total?: number
    swap_total?: number
    arch?: string
    virtualization?: string
    boot_time?: number
  }
  // Fields are `omitempty` on the wire: a zero value is simply missing.
  state?: {
    cpu?: number
    mem_used?: number
    swap_used?: number
    disk_used?: number
    net_in_transfer?: number
    net_out_transfer?: number
    net_in_speed?: number
    net_out_speed?: number
    uptime?: number
    load_1?: number
    load_5?: number
    load_15?: number
    tcp_conn_count?: number
    udp_conn_count?: number
    process_count?: number
  }
}

export interface NezhaFrame {
  now: number
  servers?: NezhaServer[]
}

export interface NezhaGroup {
  group: { id: number; name: string }
  servers: number[] | null
}

interface NezhaSetting {
  config?: { site_name?: string; language?: string }
  tsdb_enabled?: boolean
}

interface NezhaServiceInfo {
  service_id: number
  service_name: string
  created_at: number[] | null
  avg_delay: number[] | null
}

/* ---------- public_note (nezha-dash / Nazhua convention) ---------- */

interface PublicNote {
  billingDataMod?: { endDate?: string; autoRenewal?: string; cycle?: string; amount?: string }
  planDataMod?: { trafficVol?: string; trafficType?: string }
}

const CYCLES: [RegExp, number][] = [
  [/^(月|mo|month|monthly|m)$/i, 30],
  [/^(季|季度|q|quarter|quarterly)$/i, 90],
  [/^(半年|half|semi|semiannual|h)$/i, 182],
  [/^(年|y|yr|year|yearly|annual|annually)$/i, 365],
  [/^(两年|二年|2y|biennial)$/i, 730],
  [/^(三年|3y|triennial)$/i, 1095],
]

const SIZE = /^([\d.]+)\s*([KMGTP]?)i?B?$/i

function parseSize(v = ''): number {
  const m = SIZE.exec(v.trim())
  if (!m) return 0
  const pow = ' KMGTP'.indexOf((m[2] || ' ').toUpperCase())
  return Number(m[1]) * 1024 ** Math.max(0, pow)
}

export function parsePublicNote(note: string | undefined) {
  const out = {
    price: 0,
    currency: '$',
    billingCycle: 0,
    autoRenewal: false,
    expiredAt: null as number | null,
    trafficLimit: 0,
    trafficLimitType: 'max' as NodeInfo['trafficLimitType'],
  }
  if (!note || note.trim()[0] !== '{') return out
  let parsed: PublicNote
  try {
    parsed = JSON.parse(note) as PublicNote
  } catch {
    return out
  }
  const b = parsed.billingDataMod
  if (b) {
    const amount = (b.amount ?? '').trim()
    const num = /-?[\d.]+/.exec(amount)
    if (amount === '0' || /free|免费/i.test(amount)) out.price = -1
    else if (num) {
      out.price = Number(num[0])
      out.currency = amount.replace(num[0], '').trim().slice(0, 4) || '$'
    }
    out.billingCycle = CYCLES.find(([re]) => re.test((b.cycle ?? '').trim()))?.[1] ?? 0
    out.autoRenewal = b.autoRenewal === '1'
    const end = b.endDate ? Date.parse(b.endDate) : NaN
    out.expiredAt = Number.isFinite(end) && new Date(end).getUTCFullYear() > 2000 ? end : null
  }
  const p = parsed.planDataMod
  if (p?.trafficVol) {
    out.trafficLimit = parseSize(p.trafficVol)
    out.trafficLimitType = p.trafficType === '2' ? 'sum' : 'max'
  }
  return out
}

/* ---------- mapping ---------- */

const PLATFORMS: Record<string, string> = {
  istoreos: 'iStoreOS',
  openwrt: 'OpenWrt',
  centos: 'CentOS',
  opensuse: 'openSUSE',
  macos: 'macOS',
  darwin: 'macOS',
  freebsd: 'FreeBSD',
  rhel: 'RHEL',
}

/** Nezha reports platform ids such as "debian"; show them as product names. */
const prettyPlatform = (p = '') => PLATFORMS[p.toLowerCase()] ?? (p ? p[0].toUpperCase() + p.slice(1) : '')

/** "Intel Xeon 2 Virtual Core" → ["Intel Xeon", 2] */
function splitCpu(cpu = ''): [string, number] {
  const m = /^(.*?)\s+(\d+)\s+(Physical|Virtual)\s+Core$/i.exec(cpu.trim())
  return m ? [m[1], Number(m[2])] : [cpu, 0]
}

export function mapServer(s: NezhaServer, groups: Map<number, string[]>, note?: string): NodeInfo {
  const h = s.host ?? {}
  const [cpuName, cores] = splitCpu(h.cpu?.[0])
  const billing = parsePublicNote(note ?? s.public_note)
  return {
    id: String(s.id),
    name: s.name,
    groups: groups.get(s.id) ?? [],
    tags: [],
    region: (s.country_code ?? '').toUpperCase() || flagToRegion(s.name),
    os: [prettyPlatform(h.platform), h.platform_version].filter(Boolean).join(' '),
    arch: h.arch ?? '',
    cpuName,
    cpuCores: cores * Math.max(1, h.cpu?.length ?? 1),
    virtualization: h.virtualization ?? '',
    gpuName: (h.gpu ?? []).join(', '),
    kernel: '',
    memTotal: h.mem_total ?? 0,
    swapTotal: h.swap_total ?? 0,
    diskTotal: h.disk_total ?? 0,
    // Nezha sorts by display_index descending.
    weight: -(s.display_index ?? 0),
    note: '',
    ...billing,
  }
}

/** Nezha has no explicit online flag; its own frontend treats 30s of silence as offline. */
const OFFLINE_AFTER_MS = 30_000

export function mapState(s: NezhaServer, now: number): Snapshot {
  const st = s.state ?? {}
  const h = s.host ?? {}
  // A server that never reported carries Go's zero time, "0001-01-01T00:00:00Z", which parses to
  // a large negative number and printed as "last seen 739,874 days ago". Treat it as never seen.
  const parsed = s.last_active ? Date.parse(s.last_active) : NaN
  const last = parsed > 0 ? parsed : 0
  return {
    online: last > 0 && now - last < OFFLINE_AFTER_MS,
    at: last || (s.last_active ? 0 : now),
    cpu: st.cpu ?? 0,
    memUsed: st.mem_used ?? 0,
    memTotal: h.mem_total ?? 0,
    swapUsed: st.swap_used ?? 0,
    swapTotal: h.swap_total ?? 0,
    diskUsed: st.disk_used ?? 0,
    diskTotal: h.disk_total ?? 0,
    netUp: st.net_out_speed ?? 0,
    netDown: st.net_in_speed ?? 0,
    totalUp: st.net_out_transfer ?? 0,
    totalDown: st.net_in_transfer ?? 0,
    load1: st.load_1 ?? 0,
    load5: st.load_5 ?? 0,
    load15: st.load_15 ?? 0,
    tcp: st.tcp_conn_count ?? 0,
    udp: st.udp_conn_count ?? 0,
    process: st.process_count ?? 0,
    uptime: st.uptime ?? 0,
  }
}

export function groupIndex(groups: NezhaGroup[]): Map<number, string[]> {
  const index = new Map<number, string[]>()
  for (const g of groups) {
    for (const id of g.servers ?? []) index.set(id, [...(index.get(id) ?? []), g.group.name])
  }
  return index
}

/**
 * Nezha sends `public_note` **only in the first frame** after a socket connects
 * (`StreamServer.PublicNote` is filled with `withPublicNote = count == 0`), so billing
 * and quota data has to be remembered across frames — otherwise it vanishes on frame two
 * and never comes back after a reconnect.
 */
const publicNotes = new Map<string, string>()

export function mapFrame(
  frame: NezhaFrame,
  groups: Map<number, string[]>,
  notes: Map<string, string> = publicNotes,
): Required<LiveEvent> {
  const servers = frame.servers ?? []
  const now = frame.now || Date.now()
  const snapshots: Record<string, Snapshot> = {}
  const nodes: NodeInfo[] = []
  for (const s of servers) {
    const id = String(s.id)
    if (s.public_note) notes.set(id, s.public_note)
    snapshots[id] = mapState(s, now)
    nodes.push(mapServer(s, groups, notes.get(id)))
  }
  return { snapshots, nodes }
}

/* ---------- shared socket hub ---------- */

type Listener = (frame: NezhaFrame) => void

const hub = (() => {
  const listeners = new Set<Listener>()
  const statusListeners = new Set<(s: 'connecting' | 'open' | 'closed') => void>()
  let socket: ReturnType<typeof resilientSocket> | null = null
  let last: NezhaFrame | null = null
  let status: 'connecting' | 'open' | 'closed' = 'connecting'

  const ensure = () => {
    if (socket) return
    socket = resilientSocket({
      url: () => wsUrl('/api/v1/ws/server'),
      onStatus: (s) => {
        status = s
        statusListeners.forEach((l) => l(s))
      },
      onMessage: (text) => {
        try {
          last = JSON.parse(text) as NezhaFrame
          listeners.forEach((l) => l(last!))
        } catch {
          /* ignore */
        }
      },
    })
  }

  return {
    first(timeoutMs: number): Promise<NezhaFrame> {
      if (last) return Promise.resolve(last)
      ensure()
      return new Promise((resolve, reject) => {
        const once: Listener = (f) => {
          clearTimeout(timer)
          listeners.delete(once)
          resolve(f)
        }
        // Without a frame the page would sit on its skeleton forever; fail into the retry state.
        const timer = setTimeout(() => {
          listeners.delete(once)
          reject(new Error('No data from /api/v1/ws/server'))
        }, timeoutMs)
        listeners.add(once)
      })
    },
    /** A forced refresh: the next first() waits for a new frame instead of replaying the last. */
    reset() {
      socket?.close()
      socket = null
      last = null
      status = 'connecting'
    },
    listen(l: Listener, s?: (st: 'connecting' | 'open' | 'closed') => void) {
      ensure()
      listeners.add(l)
      if (s) {
        statusListeners.add(s)
        // The socket may already be open (loadNodes starts it first).
        s(status)
      }
      if (last) l(last)
      return () => {
        listeners.delete(l)
        if (s) statusListeners.delete(s)
      }
    },
  }
})()

// Module-level so socket frames replayed synchronously on subscribe already see the groups.
let groupsCache = new Map<number, string[]>()
let groupsPromise: Promise<Map<number, string[]>> | null = null
const loadGroups = () =>
  (groupsPromise ??= request<Common<NezhaGroup[]>>('/api/v1/server-group')
    .then((r) => (groupsCache = groupIndex(r.data ?? [])))
    .catch(() => groupsCache))

const FIRST_FRAME_TIMEOUT_MS = 15_000

/* ---------- adapter ---------- */

export const nezha: MonitorAdapter = {
  target: 'nezha',
  capabilities: { billing: true, trafficLimit: true, history: false, ping: true },
  adminUrl: '/dashboard',
  poweredBy: { name: 'Nezha', url: 'https://github.com/nezhahq/nezha' },
  historyRanges: [0],
  supportsTwoFactor: false,

  async loadSite(): Promise<SiteInfo> {
    const res = await request<Common<NezhaSetting>>('/api/v1/setting').catch(() => null)
    const cfg = res?.data?.config ?? {}
    return {
      name: (cfg.site_name ?? '').trim() || 'Nezha',
      description: '',
      language: cfg.language?.replace('_', '-'),
      settings: window.ZoolConfig ?? {},
      recordHours: 0,
      oauth: false,
      passwordLogin: true,
    }
  },

  async loadNodes() {
    const [frame, groups] = await Promise.all([hub.first(FIRST_FRAME_TIMEOUT_MS), loadGroups()])
    return mapFrame(frame, groups).nodes
  },

  async loadSession(): Promise<Session> {
    try {
      const res = await request<Common<{ username?: string }>>('/api/v1/profile')
      return res.success ? { loggedIn: true, username: res.data?.username } : { loggedIn: false }
    } catch {
      return { loggedIn: false }
    }
  },

  subscribe(listener, onStatus) {
    loadGroups()
    return hub.listen((frame) => listener(mapFrame(frame, groupsCache)), onStatus)
  },

  reset() {
    hub.reset()
    groupsPromise = null
  },

  async loadHistory() {
    return []
  },

  async loadPing(id): Promise<PingData> {
    const res = await request<Common<NezhaServiceInfo[]>>(`/api/v1/server/${encodeURIComponent(id)}/service`)
    const tasks: PingData['tasks'] = []
    const points: PingData['points'] = []
    for (const s of res.data ?? []) {
      const at = s.created_at ?? []
      const delay = s.avg_delay ?? []
      const values = delay.filter((v) => v > 0)
      tasks.push({
        id: s.service_id,
        name: s.service_name,
        interval: 0,
        loss: 0,
        avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
        min: values.length ? Math.min(...values) : 0,
        max: values.length ? Math.max(...values) : 0,
      })
      at.forEach((t, i) => points.push({ at: t, task: s.service_id, value: delay[i] ?? -1 }))
    }
    points.sort((a, b) => a.at - b.at)
    return { tasks, points }
  },

  async login(username, password): Promise<LoginResult> {
    try {
      const res = await request<Common<unknown>>('/api/v1/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      return res.success ? { ok: true } : { ok: false, reason: 'invalid', message: res.error }
    } catch (e) {
      return e instanceof Error && e.name !== 'AbortError' && 'status' in e
        ? { ok: false, reason: 'invalid' }
        : { ok: false, reason: 'network' }
    }
  },

  oauthUrl: () => null,
  nodePath: (id) => `/server/${encodeURIComponent(id)}`,
  // Nezha only serves the SPA for `/` and `/server/:id`.
  matchNodePath: (pathname) => /^\/server\/(\d+)/.exec(pathname)?.[1] ?? null,
}

export default nezha
