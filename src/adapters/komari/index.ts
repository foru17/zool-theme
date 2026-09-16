import { HttpError, request, resilientSocket, wsUrl } from '@/core/http'
import type {
  HistoryPoint,
  LoginResult,
  MonitorAdapter,
  NodeInfo,
  PingData,
  Session,
  SiteInfo,
  Snapshot,
  TrafficLimitType,
} from '@/core/model'
import { flagToRegion } from '@/core/region'

/* ---------- API shapes (Komari ≥ 1.4, tested on 1.5.0) ---------- */

interface Envelope<T> {
  status: string
  message?: string
  data: T
}

export interface KomariPublic {
  sitename: string
  description: string
  theme_settings?: unknown
  record_preserve_time?: number
  oauth_enable?: boolean
  oauth_provider?: string
  disable_password_login?: boolean
}

export interface KomariNode {
  uuid: string
  name: string
  cpu_name?: string
  virtualization?: string
  arch?: string
  cpu_cores?: number
  os?: string
  kernel_version?: string
  gpu_name?: string
  region?: string
  mem_total?: number
  swap_total?: number
  disk_total?: number
  weight?: number
  price?: number
  billing_cycle?: number
  auto_renewal?: boolean
  currency?: string
  expired_at?: string | null
  group?: string
  tags?: string
  public_remark?: string
  hidden?: boolean
  traffic_limit?: number
  traffic_limit_type?: string
}

/** Shape used by /api/recent and the /api/clients socket. */
export interface KomariReport {
  cpu?: { usage?: number }
  ram?: { total?: number; used?: number }
  swap?: { total?: number; used?: number }
  load?: { load1?: number; load5?: number; load15?: number }
  disk?: { total?: number; used?: number }
  network?: { up?: number; down?: number; totalUp?: number; totalDown?: number }
  connections?: { tcp?: number; udp?: number }
  uptime?: number
  process?: number
  updated_at?: string
}

export interface KomariClientsFrame {
  status?: string
  data?: { online?: string[]; data?: Record<string, KomariReport> }
}

export interface KomariRecord {
  time: string
  cpu?: number
  ram?: number
  swap?: number
  disk?: number
  net_in?: number
  net_out?: number
  load?: number
  process?: number
  connections?: number
  connections_udp?: number
  net_total_up?: number
  net_total_down?: number
}

interface KomariPingResponse {
  count: number
  records?: { task_id: number; time: string; value: number }[]
  tasks?: { id: number; name: string; interval: number; loss?: number; min?: number; max?: number; avg?: number }[]
}

/* ---------- mapping ---------- */

const TRAFFIC_TYPES: TrafficLimitType[] = ['sum', 'max', 'min', 'up', 'down']

function parseExpiry(v: string | null | undefined): number | null {
  if (!v) return null
  const t = Date.parse(v)
  // Komari uses the zero time (year 1) for "not set".
  return Number.isFinite(t) && new Date(t).getUTCFullYear() > 2000 ? t : null
}

const parseTags = (tags = '') =>
  tags
    .split(/[;,]/)
    .map((t) => t.replace(/<[^>]*>$/, '').trim())
    .filter(Boolean)

export function mapNode(n: KomariNode): NodeInfo {
  return {
    id: n.uuid,
    name: n.name || n.uuid.slice(0, 8),
    groups: n.group ? [n.group] : [],
    tags: parseTags(n.tags),
    region: flagToRegion(n.region ?? '') || flagToRegion(n.name ?? ''),
    os: n.os ?? '',
    arch: n.arch ?? '',
    cpuName: n.cpu_name ?? '',
    cpuCores: n.cpu_cores ?? 0,
    virtualization: n.virtualization ?? '',
    gpuName: n.gpu_name && n.gpu_name !== 'None' ? n.gpu_name : '',
    kernel: n.kernel_version ?? '',
    memTotal: n.mem_total ?? 0,
    swapTotal: n.swap_total ?? 0,
    diskTotal: n.disk_total ?? 0,
    weight: n.weight ?? 0,
    price: n.price ?? 0,
    currency: n.currency || '$',
    billingCycle: n.billing_cycle ?? 0,
    autoRenewal: Boolean(n.auto_renewal),
    expiredAt: parseExpiry(n.expired_at),
    trafficLimit: n.traffic_limit ?? 0,
    trafficLimitType: TRAFFIC_TYPES.includes(n.traffic_limit_type as TrafficLimitType)
      ? (n.traffic_limit_type as TrafficLimitType)
      : 'max',
    note: n.public_remark ?? '',
  }
}

export function mapReport(r: KomariReport, online: boolean): Snapshot {
  const at = r.updated_at ? Date.parse(r.updated_at) : Date.now()
  return {
    online,
    at: Number.isFinite(at) ? at : Date.now(),
    cpu: r.cpu?.usage ?? 0,
    memUsed: r.ram?.used ?? 0,
    memTotal: r.ram?.total ?? 0,
    swapUsed: r.swap?.used ?? 0,
    swapTotal: r.swap?.total ?? 0,
    diskUsed: r.disk?.used ?? 0,
    diskTotal: r.disk?.total ?? 0,
    netUp: r.network?.up ?? 0,
    netDown: r.network?.down ?? 0,
    totalUp: r.network?.totalUp ?? 0,
    totalDown: r.network?.totalDown ?? 0,
    load1: r.load?.load1 ?? 0,
    load5: r.load?.load5 ?? 0,
    load15: r.load?.load15 ?? 0,
    tcp: r.connections?.tcp ?? 0,
    udp: r.connections?.udp ?? 0,
    process: r.process ?? 0,
    uptime: r.uptime ?? 0,
  }
}

export function mapClientsFrame(frame: KomariClientsFrame): Record<string, Snapshot> {
  const online = new Set(frame.data?.online ?? [])
  const out: Record<string, Snapshot> = {}
  for (const [id, report] of Object.entries(frame.data?.data ?? {})) {
    out[id] = mapReport(report, online.has(id))
  }
  return out
}

export function mapRecord(r: KomariRecord): HistoryPoint {
  return {
    at: Date.parse(r.time),
    cpu: r.cpu ?? 0,
    memUsed: r.ram ?? 0,
    swapUsed: r.swap ?? 0,
    diskUsed: r.disk ?? 0,
    netUp: r.net_out ?? 0,
    netDown: r.net_in ?? 0,
    load1: r.load ?? 0,
    tcp: r.connections ?? 0,
    udp: r.connections_udp ?? 0,
    process: r.process ?? 0,
    totalUp: r.net_total_up,
    totalDown: r.net_total_down,
  }
}

/* ---------- adapter ---------- */

const POLL_MS = 2000

export const komari: MonitorAdapter = {
  target: 'komari',
  capabilities: { billing: true, trafficLimit: true, history: true, ping: true },
  adminUrl: '/admin',
  poweredBy: { name: 'Komari', url: 'https://github.com/komari-monitor/komari' },
  historyRanges: [0, 1, 4, 24, 168, 720],
  supportsTwoFactor: true,

  async loadSite(): Promise<SiteInfo> {
    const { data } = await request<Envelope<KomariPublic>>('/api/public')
    return {
      name: data.sitename || 'Komari',
      description: data.description ?? '',
      settings: data.theme_settings ?? {},
      recordHours: data.record_preserve_time || 720,
      oauth: Boolean(data.oauth_enable),
      oauthProvider: data.oauth_provider,
      passwordLogin: !data.disable_password_login,
    }
  },

  async loadNodes() {
    // no-store: a forced refresh must not be answered from the browser's heuristic cache
    const { data } = await request<Envelope<KomariNode[]>>('/api/nodes', { cache: 'no-store' })
    return (data ?? []).filter((n) => !n.hidden).map(mapNode)
  },

  async loadSession(): Promise<Session> {
    try {
      const me = await request<{ logged_in?: boolean; username?: string }>('/api/me')
      return { loggedIn: Boolean(me.logged_in), username: me.logged_in ? me.username : undefined }
    } catch {
      return { loggedIn: false }
    }
  },

  subscribe(listener, onStatus) {
    let poll: ReturnType<typeof setInterval> | undefined
    const ask = (ws: WebSocket | null) => {
      if (ws?.readyState === WebSocket.OPEN && document.visibilityState === 'visible') ws.send('get')
    }
    const socket = resilientSocket({
      url: () => wsUrl('/api/clients'),
      onStatus,
      onOpen: (ws) => {
        // Always fetch once, even in a background tab; only the polling pauses while hidden.
        ws.send('get')
        clearInterval(poll)
        poll = setInterval(() => ask(socket.socket), POLL_MS)
      },
      onMessage: (text) => {
        try {
          listener({ snapshots: mapClientsFrame(JSON.parse(text) as KomariClientsFrame) })
        } catch {
          /* ignore malformed frame */
        }
      },
    })
    const onVisible = () => ask(socket.socket)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      socket.close()
    }
  },

  async loadHistory(id, hours) {
    const res = await request<Envelope<{ records?: KomariRecord[] }>>(
      `/api/records/load?uuid=${encodeURIComponent(id)}&hours=${hours}`,
      {},
      60_000,
    )
    return (res.data.records ?? []).map(mapRecord).sort((a, b) => a.at - b.at)
  },

  async loadPing(id, hours): Promise<PingData> {
    const res = await request<Envelope<KomariPingResponse>>(
      `/api/records/ping?uuid=${encodeURIComponent(id)}&hours=${hours}`,
      {},
      60_000,
    )
    const d = res.data
    return {
      tasks: (d.tasks ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        interval: t.interval,
        loss: t.loss ?? 0,
        avg: t.avg ?? 0,
        min: t.min ?? 0,
        max: t.max ?? 0,
      })),
      points: (d.records ?? [])
        .map((r) => ({ at: Date.parse(r.time), task: r.task_id, value: r.value }))
        .sort((a, b) => a.at - b.at),
    }
  },

  async login(username, password, code): Promise<LoginResult> {
    try {
      await request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, ...(code ? { '2fa_code': code } : {}) }),
      })
      return { ok: true }
    } catch (e) {
      if (e instanceof HttpError) {
        const msg = String((e.body as { message?: string } | null)?.message ?? '')
        if (/2fa code is required/i.test(msg)) return { ok: false, reason: 'need2fa' }
        if (/invalid 2fa/i.test(msg)) return { ok: false, reason: 'invalid2fa' }
        return { ok: false, reason: 'invalid', message: msg || undefined }
      }
      return { ok: false, reason: 'network' }
    }
  },

  oauthUrl: (site) => (site.oauth ? '/api/oauth' : null),
  nodePath: (id) => `/instance/${encodeURIComponent(id)}`,
  matchNodePath: (pathname) => /^\/instance\/([^/]+)/.exec(pathname)?.[1] ?? null,
}

export default komari
