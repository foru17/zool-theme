import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nezha } from '../src/adapters/nezha'

/**
 * Nezha v2 renamed the service fields: model.ServiceInfos is serialised with the
 * JSON tags "monitor_id" / "monitor_name" (model/service_history_api.go).
 * The latency rows are labelled with that name, so a wrong field name leaves
 * every row without a label.
 */
const v2Payload = {
  success: true,
  data: [
    {
      monitor_id: 7,
      server_id: 1,
      monitor_name: '电信-河北',
      server_name: 'NanoPi R5S',
      display_index: 0,
      created_at: [1, 2, 3],
      avg_delay: [10, 20, 30],
    },
    {
      monitor_id: 8,
      server_id: 1,
      monitor_name: '联通-河北廊坊',
      server_name: 'NanoPi R5S',
      display_index: 0,
      created_at: [1, 2],
      avg_delay: [5, 15],
    },
  ],
}

/** Nezha v1 sent the same list as "service_id" / "service_name". */
const v1Payload = {
  success: true,
  data: [{ service_id: 3, service_name: '移动-河北', created_at: [1], avg_delay: [7] }],
}

function stubService(payload: unknown) {
  vi.stubGlobal('fetch', async (url: string) =>
    new Response(JSON.stringify(url.includes('/service') ? payload : { success: true, data: [] }), { status: 200 }),
  )
}

beforeEach(() => {
  vi.stubGlobal('window', { location: { protocol: 'https:', host: 'status.test' }, ZoolConfig: {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('nezha loadPing', () => {
  it('labels every row with the v2 monitor name', async () => {
    stubService(v2Payload)
    const data = await nezha.loadPing('1', 24)
    expect(data.tasks.map((t) => t.name)).toEqual(['电信-河北', '联通-河北廊坊'])
    expect(data.tasks.map((t) => t.id)).toEqual([7, 8])
    expect(data.tasks[0].avg).toBe(20)
    expect(data.tasks[0].min).toBe(10)
    expect(data.tasks[0].max).toBe(30)
  })

  it('keeps the v1 service name working', async () => {
    stubService(v1Payload)
    const data = await nezha.loadPing('1', 24)
    expect(data.tasks.map((t) => t.name)).toEqual(['移动-河北'])
    expect(data.tasks.map((t) => t.id)).toEqual([3])
  })

  it('keeps each point attached to its own task', async () => {
    stubService(v2Payload)
    const data = await nezha.loadPing('1', 24)
    const byTask = new Map<number, number[]>()
    for (const p of data.points) byTask.set(p.task, [...(byTask.get(p.task) ?? []), p.value])
    expect(byTask.get(7)).toEqual([10, 20, 30])
    expect(byTask.get(8)).toEqual([5, 15])
  })
})
