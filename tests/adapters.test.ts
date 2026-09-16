import { describe, expect, it } from 'vitest'
import { mapClientsFrame, mapNode, mapRecord, type KomariClientsFrame, type KomariNode, type KomariRecord } from '../src/adapters/komari'
import { groupIndex, mapFrame, mapState, parsePublicNote, type NezhaFrame, type NezhaGroup } from '../src/adapters/nezha'
import komariNodes from './fixtures/komari-nodes.json'
import komariFrame from './fixtures/komari-clients-frame.json'
import komariRecords from './fixtures/komari-records.json'
import nezhaFrame from './fixtures/nezha-frame.json'
import nezhaGroups from './fixtures/nezha-groups.json'

describe('komari adapter', () => {
  const nodes = (komariNodes.data as KomariNode[]).map(mapNode)

  it('maps every node from /api/nodes', () => {
    expect(nodes).toHaveLength(17)
    for (const n of nodes) {
      expect(n.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(n.memTotal).toBeGreaterThan(0)
      expect(['sum', 'max', 'min', 'up', 'down']).toContain(n.trafficLimitType)
    }
  })

  it('turns emoji regions into ISO codes', () => {
    const regions = new Set(nodes.map((n) => n.region))
    expect(regions).toContain('US')
    expect(regions).toContain('CN')
    for (const r of regions) expect(r).toMatch(/^([A-Z]{2})?$/)
  })

  it('treats the zero time as "no expiry"', () => {
    expect(mapNode({ uuid: 'x', name: 'x', expired_at: '0001-01-01T00:00:00Z' }).expiredAt).toBeNull()
    expect(mapNode({ uuid: 'x', name: 'x', expired_at: '2030-01-01T00:00:00Z' }).expiredAt).toBe(Date.parse('2030-01-01T00:00:00Z'))
  })

  it('maps a /api/clients frame to snapshots', () => {
    const snaps = mapClientsFrame(komariFrame as KomariClientsFrame)
    const ids = Object.keys(snaps)
    expect(ids.length).toBe(17)
    const s = snaps[ids[0]]
    expect(s.online).toBe(true)
    expect(s.memTotal).toBeGreaterThan(0)
    expect(s.at).toBeGreaterThan(0)
  })

  it('maps history records with in/out swapped to down/up', () => {
    const r = (komariRecords.data.records as KomariRecord[])[0]
    const p = mapRecord(r)
    expect(p.netDown).toBe(r.net_in)
    expect(p.netUp).toBe(r.net_out)
    expect(p.at).toBe(Date.parse(r.time))
  })
})

describe('nezha adapter', () => {
  const groups = groupIndex(nezhaGroups.data as NezhaGroup[])
  const event = mapFrame(nezhaFrame as NezhaFrame, groups)

  it('maps servers and their groups from the socket frame', () => {
    expect(event.nodes).toHaveLength(20)
    expect(event.nodes.filter((n) => n.groups.length > 0).length).toBeGreaterThan(10)
    expect(Object.keys(event.snapshots)).toHaveLength(20)
  })

  it('fills omitted zero values', () => {
    const s = mapFrame({ now: 10_000, servers: [{ id: 1, name: 'a', last_active: new Date(9_000).toISOString() }] }, new Map())
    expect(s.snapshots['1'].cpu).toBe(0)
    expect(s.snapshots['1'].online).toBe(true)
  })

  it('marks servers silent for 30s as offline', () => {
    const s = mapFrame({ now: 100_000, servers: [{ id: 1, name: 'a', last_active: new Date(60_000).toISOString() }] }, new Map())
    expect(s.snapshots['1'].online).toBe(false)
  })

  it('remembers public_note after the first frame drops it', () => {
    // Nezha only fills public_note in the first frame of a connection.
    const note = JSON.stringify({ billingDataMod: { amount: '$36', cycle: 'Month' } })
    const server = { id: 7, name: 'a', last_active: new Date().toISOString() }
    const notes = new Map<string, string>()
    const first = mapFrame({ now: Date.now(), servers: [{ ...server, public_note: note }] }, new Map(), notes)
    const second = mapFrame({ now: Date.now(), servers: [server] }, new Map(), notes)
    expect(first.nodes[0].price).toBe(36)
    expect(second.nodes[0]).toMatchObject({ price: 36, billingCycle: 30 })
  })

  it('parses billing from public_note', () => {
    const b = parsePublicNote(
      JSON.stringify({
        billingDataMod: { endDate: '2031-05-01T00:00:00+08:00', autoRenewal: '1', cycle: 'Year', amount: '$36' },
        planDataMod: { trafficVol: '2TB', trafficType: '2' },
      }),
    )
    expect(b).toMatchObject({ price: 36, currency: '$', billingCycle: 365, autoRenewal: true, trafficLimitType: 'sum' })
    expect(b.trafficLimit).toBe(2 * 1024 ** 4)
    expect(b.expiredAt).toBe(Date.parse('2031-05-01T00:00:00+08:00'))
    expect(parsePublicNote('just a note').price).toBe(0)
    expect(parsePublicNote('{"billingDataMod":{"amount":"0","endDate":"0000-00-00T23:59:59+08:00"}}')).toMatchObject({ price: -1, expiredAt: null })
  })
})

describe('nezha mapState last_active', () => {
  const now = Date.parse('2026-09-16T08:00:00Z')

  it('treats Go zero time as never seen, not 739,874 days ago', () => {
    const s = mapState({ id: 1, name: 'x', last_active: '0001-01-01T00:00:00Z' } as never, now)
    expect(s.online).toBe(false)
    expect(s.at).toBe(0)
  })

  it('keeps a real report time', () => {
    const s = mapState({ id: 1, name: 'x', last_active: '2026-09-16T07:59:50Z' } as never, now)
    expect(s.online).toBe(true)
    expect(s.at).toBe(Date.parse('2026-09-16T07:59:50Z'))
  })
})
