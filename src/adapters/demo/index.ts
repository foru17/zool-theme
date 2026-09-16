import { emptySnapshot, type HistoryPoint, type MonitorAdapter, type NodeInfo, type Snapshot } from '@/core/model'

/**
 * A self-contained adapter with synthetic data, for `pnpm dev:demo`, screenshots and
 * trying the theme without a backend. Numbers are generated, not real.
 */

const GB = 1024 ** 3
const TB = 1024 ** 4
const DAY = 86_400_000

interface Seed {
  name: string
  region: string
  group: string
  os: string
  cores: number
  mem: number
  disk: number
  price: number
  currency: string
  cycle: number
  expiresInDays: number | null
  limit: number
  base: number
  /**
   * How this node is failing, if it is: gone quiet a few minutes ago, down for days, never
   * reported, or reporting but late. One of each, so every state the theme draws is on screen.
   */
  state?: 'recent' | 'offline' | 'never' | 'stale'
}

const SEEDS: Seed[] = [
  { name: 'Tokyo Edge', region: 'JP', group: 'Edge', os: 'Debian GNU/Linux 12', cores: 4, mem: 8, disk: 80, price: 12, currency: '$', cycle: 30, expiresInDays: 18, limit: 2 * TB, base: 14 },
  { name: 'Hong Kong CN2', region: 'HK', group: 'Edge', os: 'Ubuntu 24.04 LTS', cores: 2, mem: 4, disk: 60, price: 88, currency: '¥', cycle: 30, expiresInDays: 42, limit: 1 * TB, base: 22 },
  { name: 'San Jose', region: 'US', group: 'Core', os: 'Debian GNU/Linux 13', cores: 16, mem: 32, disk: 400, price: 240, currency: '$', cycle: 365, expiresInDays: 210, limit: 0, base: 9 },
  // A busy box: `base` drives CPU and network, and this one is meant to sit in the warning
  // band so the demo actually shows what a threshold looks like.
  { name: 'Frankfurt', region: 'DE', group: 'Core', os: 'Debian GNU/Linux 12', cores: 8, mem: 16, disk: 240, price: 9.5, currency: '€', cycle: 30, expiresInDays: 6, limit: 20 * TB, base: 58 },
  { name: 'Singapore', region: 'SG', group: 'Edge', os: 'Alpine Linux 3.22', cores: 1, mem: 1, disk: 20, price: -1, currency: '$', cycle: 0, expiresInDays: null, limit: 0, base: 4 },
  { name: 'Shanghai', region: 'CN', group: 'Core', os: 'Ubuntu 22.04 LTS', cores: 4, mem: 8, disk: 100, price: 699, currency: '¥', cycle: 365, expiresInDays: 120, limit: 0, base: 18 },
  { name: 'Home NAS', region: 'CN', group: 'Lab', os: 'Unraid 7.1', cores: 12, mem: 64, disk: 36_000, price: 0, currency: '$', cycle: 0, expiresInDays: null, limit: 0, base: 11 },
  { name: 'Lab Router', region: 'CN', group: 'Lab', os: 'OpenWrt 24.10', cores: 4, mem: 1, disk: 8, price: 0, currency: '$', cycle: 0, expiresInDays: null, limit: 0, base: 3, state: 'offline' },
  { name: 'Osaka Relay', region: 'JP', group: 'Edge', os: 'Debian GNU/Linux 12', cores: 2, mem: 2, disk: 40, price: 5, currency: '$', cycle: 30, expiresInDays: 25, limit: 0.5 * TB, base: 12, state: 'recent' },
  { name: 'Seoul Mirror', region: 'KR', group: 'Edge', os: 'Rocky Linux 9.4', cores: 2, mem: 4, disk: 80, price: 7, currency: '$', cycle: 30, expiresInDays: 60, limit: 0, base: 8, state: 'stale' },
  { name: 'Paris Spare', region: 'FR', group: 'Core', os: 'Debian GNU/Linux 13', cores: 2, mem: 4, disk: 40, price: 4, currency: '€', cycle: 30, expiresInDays: -5, limit: 0, base: 0, state: 'never' },
]

const nodes: NodeInfo[] = SEEDS.map((s, i) => ({
  id: `demo-${i + 1}`,
  name: s.name,
  groups: [s.group],
  tags: [],
  region: s.region,
  os: s.os,
  arch: i === 7 ? 'arm64' : 'amd64',
  cpuName: i % 2 ? 'AMD EPYC 7B13' : 'Intel Xeon Platinum 8370C',
  cpuCores: s.cores,
  virtualization: i > 5 ? '' : 'kvm',
  gpuName: '',
  kernel: '6.12.0',
  memTotal: s.mem * GB,
  swapTotal: i % 3 === 0 ? 2 * GB : 0,
  diskTotal: s.disk * GB,
  weight: i,
  price: s.price,
  currency: s.currency,
  billingCycle: s.cycle,
  autoRenewal: i % 2 === 0,
  expiredAt: s.expiresInDays === null ? null : Date.now() + s.expiresInDays * DAY,
  trafficLimit: s.limit,
  trafficLimitType: 'max',
  note: '',
}))

const wave = (t: number, seed: number, period: number) => Math.sin(t / period + seed) * 0.5 + 0.5

/**
 * How full each box's disk is. Spelled out rather than computed, because the point of these
 * numbers is to park one node in the warning band and one past it: disks do not move like CPU
 * does, so they are the only reading that can hold a threshold colour still long enough to see.
 */
const DISK_FILL = [0.2, 0.4, 0.6, 0.88, 0.96]

const lastReports: Snapshot[] = []

function sample(i: number, t: number): Snapshot {
  const s = SEEDS[i]
  if (s.state === 'never') return { ...emptySnapshot(false), at: 0 }
  // a node that is not reporting repeats its last report, so its figures hold still
  const live = s.state ? (lastReports[i] ??= sampleLive(i, Date.now())) : sampleLive(i, t)
  if (s.state === 'recent') return { ...live, online: false, at: t - 4 * 60_000 }
  if (s.state === 'offline') return { ...live, online: false, at: t - 3 * DAY, netUp: 0, netDown: 0 }
  if (s.state === 'stale') return { ...live, at: t - 9 * 60_000 }
  return live
}

function sampleLive(i: number, t: number): Snapshot {
  const s = SEEDS[i]
  const n = nodes[i]
  const jitter = (k: number) => wave(t, i * 7 + k, 9_000 + k * 1_300) * 0.6 + Math.random() * 0.4
  const cpu = Math.min(98, s.base * (0.5 + jitter(1)))
  const up = (40 + s.base * 60) * 1024 * (0.2 + jitter(2))
  const down = (60 + s.base * 90) * 1024 * (0.2 + jitter(3))
  const days = 3 + i * 17
  return {
    online: true,
    at: t,
    cpu,
    // One box runs hot on memory and one is nearly out of disk. A demo that never crosses a
    // threshold never shows the warning colours, which is most of what the instruments do.
    memUsed: n.memTotal * Math.min(0.97, (i === 6 ? 0.55 : 0.22) + 0.5 * wave(t, i, 60_000)),
    memTotal: n.memTotal,
    swapUsed: n.swapTotal * 0.08,
    swapTotal: n.swapTotal,
    diskUsed: n.diskTotal * DISK_FILL[i % DISK_FILL.length],
    diskTotal: n.diskTotal,
    netUp: up,
    netDown: down,
    totalUp: (0.4 + i * 0.37) * TB,
    totalDown: (0.6 + i * 0.52) * TB,
    load1: (cpu / 100) * s.cores * 0.9,
    load5: (cpu / 100) * s.cores * 0.8,
    load15: (cpu / 100) * s.cores * 0.7,
    tcp: Math.round(120 + s.base * 30 * jitter(4)),
    udp: Math.round(8 + s.base * jitter(5)),
    process: Math.round(90 + s.base * 6),
    uptime: days * 86_400 + (t / 1000) % 86_400,
  }
}

const snapshotAll = () => {
  const t = Date.now()
  return Object.fromEntries(nodes.map((n, i) => [n.id, sample(i, t)]))
}

export const demo: MonitorAdapter = {
  target: 'demo',
  capabilities: { billing: true, trafficLimit: true, history: true, ping: true },
  adminUrl: '#',
  poweredBy: { name: 'Demo data', url: 'https://github.com/foru17/zool-theme' },
  historyRanges: [0, 1, 4, 24, 168, 720],
  supportsTwoFactor: false,

  loadSite: async () => ({
    name: 'ZOOL Status',
    description: 'Demo data',
    settings: {},
    recordHours: 720,
    oauth: false,
    passwordLogin: true,
  }),
  loadNodes: async () => nodes,
  loadSession: async () => ({ loggedIn: false }),

  subscribe(listener, onStatus) {
    onStatus?.('open')
    listener({ snapshots: snapshotAll() })
    const timer = setInterval(() => listener({ snapshots: snapshotAll() }), 2000)
    return () => clearInterval(timer)
  },

  async loadHistory(id, hours) {
    const i = nodes.findIndex((n) => n.id === id)
    if (i < 0 || SEEDS[i].state === 'never') return []
    const points = Math.min(240, Math.max(60, hours * 12))
    const step = (hours * 3_600_000) / points
    const end = Date.now()
    const out: HistoryPoint[] = []
    for (let k = 0; k <= points; k++) {
      const s = sample(i, end - (points - k) * step)
      out.push({ at: s.at, cpu: s.cpu, memUsed: s.memUsed, swapUsed: s.swapUsed, diskUsed: s.diskUsed, netUp: s.netUp, netDown: s.netDown, load1: s.load1, tcp: s.tcp, udp: s.udp, process: s.process })
    }
    return out
  },

  async loadPing(id, hours) {
    const i = nodes.findIndex((n) => n.id === id)
    const tasks = [
      { id: 1, name: 'Cloudflare 1.1.1.1', interval: 60, loss: 0.2, avg: 0, min: 0, max: 0 },
      { id: 2, name: 'Home gateway', interval: 60, loss: 1.4, avg: 0, min: 0, max: 0 },
    ]
    const points = []
    const n = Math.min(240, hours * 30)
    const step = (hours * 3_600_000) / n
    const end = Date.now()
    for (const task of tasks) {
      const base = 12 + i * 9 + task.id * 21
      const values: number[] = []
      for (let k = 0; k <= n; k++) {
        const at = end - (n - k) * step
        const lost = Math.random() < task.loss / 100
        const value = lost ? -1 : base + wave(at, task.id, 400_000) * 10 + Math.random() * 6
        if (!lost) values.push(value)
        points.push({ at, task: task.id, value })
      }
      task.avg = values.reduce((a, b) => a + b, 0) / values.length
      task.min = Math.min(...values)
      task.max = Math.max(...values)
    }
    return { tasks, points }
  },

  login: async () => ({ ok: false, reason: 'invalid', message: 'Sign-in is disabled in the demo.' }),
  oauthUrl: () => null,
  nodePath: (id) => `/instance/${id}`,
  matchNodePath: (pathname) => /^\/instance\/([^/]+)/.exec(pathname)?.[1] ?? null,
}

export default demo
