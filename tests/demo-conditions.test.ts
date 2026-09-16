import { expect, it } from 'vitest'
import { demo } from '../src/adapters/demo'
import { nodeCondition } from '../src/core/condition'
import type { LiveEvent } from '../src/core/model'

it('the demo fleet shows every node condition and both failure reasons', async () => {
  const nodes = await demo.loadNodes()
  let event: LiveEvent | undefined
  const stop = demo.subscribe((e) => (event = e))
  stop()
  const now = Date.now()
  const conditions = nodes.map((n) => nodeCondition(n, event!.snapshots[n.id], now, true))
  expect(new Set(conditions.map((c) => c.kind))).toEqual(new Set(['online', 'stale', 'recent', 'offline', 'never']))
  expect(conditions.some((c) => c.expired)).toBe(true)
  expect(conditions.some((c) => c.quotaUsed)).toBe(true)
  // A node that went down with readings keeps them; the one that never reported has none.
  expect(conditions.find((c) => c.kind === 'recent')!.readings).toBe(true)
  expect(conditions.find((c) => c.kind === 'never')!.readings).toBe(false)
})
