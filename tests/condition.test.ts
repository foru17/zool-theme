import { describe, expect, it } from 'vitest'
import { cleanSnapshot, nodeCondition, RECENT_MS, STALE_MS } from '../src/core/condition'
import { emptySnapshot, type NodeInfo, type Snapshot } from '../src/core/model'

const now = Date.parse('2026-09-17T08:00:00Z')
const node = (patch: Partial<NodeInfo> = {}) => ({ id: 'n', name: 'n', groups: [], weight: 0, expiredAt: null, trafficLimit: 0, trafficLimitType: 'sum', ...patch }) as NodeInfo
const snap = (patch: Partial<Snapshot> = {}): Snapshot => ({ ...emptySnapshot(true), at: now - 2000, memTotal: 8e9, diskTotal: 1e11, uptime: 100, ...patch })

describe('nodeCondition', () => {
  it('calls a report late after five minutes and an outage recent for ten', () => {
    expect(STALE_MS).toBe(300_000)
    expect(RECENT_MS).toBe(600_000)
  })

  it('is pending with no snapshot before the first frame, offline without a time after it', () => {
    expect(nodeCondition(node(), undefined, now, false).kind).toBe('pending')
    const after = nodeCondition(node(), undefined, now, true)
    expect(after.kind).toBe('offline')
    expect(after.lastSeen).toBeNull()
    expect(after.readings).toBe(false)
  })

  it('is online when reporting, stale when the report is old', () => {
    expect(nodeCondition(node(), snap(), now, true).kind).toBe('online')
    expect(nodeCondition(node(), snap({ at: now - STALE_MS - 1 }), now, true).kind).toBe('stale')
  })

  it('separates a recent drop from a long outage, and never-reported from both', () => {
    const recent = nodeCondition(node(), snap({ online: false, at: now - 60_000 }), now, true)
    expect(recent.kind).toBe('recent')
    expect(recent.lastSeen).toBe(now - 60_000)
    expect(recent.readings).toBe(true)
    expect(nodeCondition(node(), snap({ online: false, at: now - RECENT_MS - 1 }), now, true).kind).toBe('offline')
    expect(nodeCondition(node(), { ...emptySnapshot(false), at: 0 }, now, true).kind).toBe('never')
  })

  it('treats an all-zero snapshot as having no readings', () => {
    expect(nodeCondition(node(), { ...emptySnapshot(false), at: now - 5 * RECENT_MS }, now, true).readings).toBe(false)
  })

  it('flags expiry and a used-up traffic quota', () => {
    expect(nodeCondition(node({ expiredAt: now - 1 }), snap(), now, true).expired).toBe(true)
    expect(nodeCondition(node({ expiredAt: now + 86_400_000 }), snap(), now, true).expired).toBe(false)
    const quota = nodeCondition(node({ trafficLimit: 100, trafficLimitType: 'sum' }), snap({ totalUp: 60, totalDown: 50 }), now, true)
    expect(quota.quotaUsed).toBe(true)
    expect(nodeCondition(node({ trafficLimit: 100, trafficLimitType: 'sum' }), snap({ totalUp: 10, totalDown: 10 }), now, true).quotaUsed).toBe(false)
  })
})

describe('cleanSnapshot', () => {
  it('zeroes non-finite and negative numbers and caps CPU at 100', () => {
    const s = cleanSnapshot(snap({ cpu: 180, memUsed: Number.NaN, netUp: -5, diskUsed: Number.POSITIVE_INFINITY }))
    expect(s.cpu).toBe(100)
    expect(s.memUsed).toBe(0)
    expect(s.netUp).toBe(0)
    expect(s.diskUsed).toBe(0)
    expect(s.online).toBe(true)
  })
})
