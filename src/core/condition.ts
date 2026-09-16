import type { NodeInfo, Snapshot } from './model'
import { ratio, trafficUsed } from './format'

/**
 * What a node's row or card should say about it, beyond its readings.
 *
 * - `pending`: no live frame yet; the node is waiting, not down.
 * - `online`: reporting normally.
 * - `stale`: marked online, but its last report is older than STALE_MS.
 * - `recent`: offline, last seen within RECENT_MS — often a restart or a network blip.
 * - `offline`: offline for longer, or offline with no known last report (Komari does not send
 *   one for nodes that were already down when the page loaded).
 * - `never`: the backend says it has never reported.
 */
export type ConditionKind = 'pending' | 'online' | 'stale' | 'recent' | 'offline' | 'never'

export interface Condition {
  kind: ConditionKind
  /** Epoch ms of the last report, when known. */
  lastSeen: number | null
  /** The snapshot carries readings worth showing (a panel restart can leave only zeros). */
  readings: boolean
  expired: boolean
  quotaUsed: boolean
}

export const STALE_MS = 5 * 60_000
export const RECENT_MS = 10 * 60_000

export const hasReadings = (s: Snapshot | undefined) => Boolean(s && (s.memTotal > 0 || s.diskTotal > 0 || s.uptime > 0))

export function nodeCondition(node: NodeInfo, snap: Snapshot | undefined, now: number, fed: boolean): Condition {
  const lastSeen = snap && snap.at > 0 ? snap.at : null
  const quota = node.trafficLimit > 0 && snap ? ratio(trafficUsed(node.trafficLimitType, snap.totalUp, snap.totalDown), node.trafficLimit) : 0
  const kind: ConditionKind = !snap
    ? fed
      ? 'offline'
      : 'pending'
    : snap.online
      ? lastSeen && now - lastSeen > STALE_MS
        ? 'stale'
        : 'online'
      : !lastSeen
        ? 'never'
        : now - lastSeen <= RECENT_MS
          ? 'recent'
          : 'offline'
  return {
    kind,
    lastSeen,
    readings: hasReadings(snap),
    expired: node.expiredAt !== null && node.expiredAt > 0 && node.expiredAt < now,
    quotaUsed: quota >= 100,
  }
}

/** Readings arrive from other people's agents: a NaN or a CPU of 180% must not reach a gauge. */
export function cleanSnapshot(s: Snapshot): Snapshot {
  const out = { ...s }
  for (const key of Object.keys(out) as (keyof Snapshot)[]) {
    const v = out[key]
    if (typeof v === 'number' && !(Number.isFinite(v) && v >= 0)) (out as Record<string, unknown>)[key] = 0
  }
  out.cpu = Math.min(100, out.cpu)
  return out
}
