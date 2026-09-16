/**
 * The unified data model. Everything in `src/core`, `src/components` and `src/pages`
 * only speaks this model; each backend has an adapter in `src/adapters/*` that maps
 * its own API onto it.
 */

export type Target = 'komari' | 'nezha' | 'demo'

export type TrafficLimitType = 'sum' | 'max' | 'min' | 'up' | 'down'

export interface Capabilities {
  /** Price, billing cycle and expiry are available. */
  billing: boolean
  /** A per-node traffic quota is available. */
  trafficLimit: boolean
  /** Server-side history beyond the live buffer. */
  history: boolean
  /** Latency / ping monitoring. */
  ping: boolean
}

export interface SiteInfo {
  name: string
  description: string
  /** Backend default language, e.g. `zh-CN`. */
  language?: string
  /** Raw theme settings as provided by the backend; see `normalizeSettings`. */
  settings: unknown
  /** Longest history range the backend keeps, in hours. */
  recordHours: number
  oauth: boolean
  oauthProvider?: string
  /** False when the backend only allows OAuth sign-in. */
  passwordLogin: boolean
}

export interface NodeInfo {
  id: string
  name: string
  groups: string[]
  tags: string[]
  /** ISO 3166-1 alpha-2, upper case. Empty when unknown. */
  region: string
  os: string
  arch: string
  cpuName: string
  cpuCores: number
  virtualization: string
  gpuName: string
  kernel: string
  memTotal: number
  swapTotal: number
  diskTotal: number
  /** Lower sorts first. */
  weight: number
  /** 0 = not set, -1 = free. */
  price: number
  currency: string
  /** Billing cycle in days (30 ≈ monthly, 365 ≈ yearly). 0 = not set, -1 = one-time. */
  billingCycle: number
  autoRenewal: boolean
  /** Expiry as epoch ms, or null when not set / never expires. */
  expiredAt: number | null
  /** Bytes; 0 = unlimited. */
  trafficLimit: number
  trafficLimitType: TrafficLimitType
  note: string
}

export interface Snapshot {
  online: boolean
  /** Epoch ms of the report. */
  at: number
  cpu: number
  memUsed: number
  memTotal: number
  swapUsed: number
  swapTotal: number
  diskUsed: number
  diskTotal: number
  /** Bytes per second. */
  netUp: number
  netDown: number
  /** Cumulative bytes. */
  totalUp: number
  totalDown: number
  load1: number
  load5: number
  load15: number
  tcp: number
  udp: number
  process: number
  /** Seconds. */
  uptime: number
}

export interface HistoryPoint {
  at: number
  /** When the node said it measured this, if it told us. Live points stamp `at` with our own
   *  clock, so this is kept separately to deduplicate repeated reports. */
  reportedAt?: number
  cpu: number
  memUsed: number
  swapUsed: number
  diskUsed: number
  netUp: number
  netDown: number
  load1: number
  tcp: number
  udp: number
  process: number
  /** Cumulative counters at this point, when the backend records them. */
  totalUp?: number
  totalDown?: number
}

export interface PingTask {
  id: number
  name: string
  /** Seconds between probes. */
  interval: number
  /** 0–100. */
  loss: number
  avg: number
  min: number
  max: number
}

export interface PingPoint {
  at: number
  task: number
  /** Milliseconds; negative means the probe was lost. */
  value: number
}

export interface PingData {
  tasks: PingTask[]
  points: PingPoint[]
}

export interface Session {
  loggedIn: boolean
  username?: string
}

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'need2fa' | 'invalid' | 'invalid2fa' | 'network'; message?: string }

export type ConnectionStatus = 'connecting' | 'open' | 'closed'

export interface LiveEvent {
  snapshots: Record<string, Snapshot>
  /** Some backends (Nezha) push node metadata over the same socket. */
  nodes?: NodeInfo[]
}

export interface MonitorAdapter {
  readonly target: Target
  readonly capabilities: Capabilities
  /** Where the built-in admin panel lives. */
  readonly adminUrl: string
  readonly poweredBy: { name: string; url: string }
  /** History ranges in hours offered on the node page; 0 = live buffer. */
  readonly historyRanges: number[]
  /** True when the login form needs a 2FA field up-front. */
  readonly supportsTwoFactor: boolean
  loadSite(): Promise<SiteInfo>
  loadNodes(): Promise<NodeInfo[]>
  loadSession(): Promise<Session>
  subscribe(listener: (event: LiveEvent) => void, onStatus?: (status: ConnectionStatus) => void): () => void
  /** Drop any cached connection or frame so the next load and subscribe start fresh. */
  reset?(): void
  loadHistory(id: string, hours: number): Promise<HistoryPoint[]>
  loadPing(id: string, hours: number): Promise<PingData>
  login(username: string, password: string, code?: string): Promise<LoginResult>
  oauthUrl(site: SiteInfo): string | null
  nodePath(id: string): string
  matchNodePath(pathname: string): string | null
}

export const emptySnapshot = (online = false): Snapshot => ({
  online,
  at: 0,
  cpu: 0,
  memUsed: 0,
  memTotal: 0,
  swapUsed: 0,
  swapTotal: 0,
  diskUsed: 0,
  diskTotal: 0,
  netUp: 0,
  netDown: 0,
  totalUp: 0,
  totalDown: 0,
  load1: 0,
  load5: 0,
  load15: 0,
  tcp: 0,
  udp: 0,
  process: 0,
  uptime: 0,
})
