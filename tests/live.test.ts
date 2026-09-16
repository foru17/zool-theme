import { describe, expect, it } from 'vitest'
import {
  blindNow,
  bucketSeries,
  coreTicks,
  fitCells,
  focusPoints,
  liveSpanMinutes,
  memoryBlocks,
  noteFrame,
  reportRun,
  type BlindWindow,
} from '../src/core/live'
import type { HistoryPoint } from '../src/core/model'

const point = (at: number, netUp = 0): HistoryPoint => ({
  at,
  cpu: 0,
  memUsed: 0,
  swapUsed: 0,
  diskUsed: 0,
  netUp,
  netDown: 0,
  load1: 0,
  tcp: 0,
  udp: 0,
  process: 0,
})

describe('bucketSeries', () => {
  it('averages samples and leaves empty buckets null', () => {
    // Buckets are 100 ms wide: 0 and 50 share the first one, 100 starts the second.
    const points = [point(0, 10), point(50, 20), point(100, 7), point(900, 5)]
    const buckets = bucketSeries(points, (p) => p.netUp, 10, 0, 1000)
    expect(buckets).toHaveLength(10)
    expect(buckets[0].value).toBe(15)
    expect(buckets[1].value).toBe(7)
    expect(buckets[2].value).toBeNull() // the gap stays visible
    expect(buckets[9].value).toBe(5)
  })

  it('ignores samples outside the window', () => {
    const buckets = bucketSeries([point(-500, 99), point(500, 3)], (p) => p.netUp, 4, 0, 1000)
    expect(buckets.filter((b) => b.value !== null)).toHaveLength(1)
  })
})

describe('reportRun', () => {
  it('marks silence as false and pre-history as null', () => {
    const now = 600_000
    // One sample per minute for the last 5 minutes; nothing before that.
    const points = [4, 3, 2, 1, 0].map((m) => point(now - m * 60_000)).sort((a, b) => a.at - b.at)
    const run = reportRun(points, 10, 10, now)
    expect(run).toHaveLength(10)
    expect(run.slice(0, 4).every((v) => v === null)).toBe(true)
    expect(run[run.length - 1]).toBe(true)
  })
})

describe('noteFrame / blindNow', () => {
  const GAP = 8_000

  it('records a window when frames stop arriving, not when a socket says so', () => {
    // A backgrounded Komari tab keeps its socket open but stops asking, so only the silence
    // between frames can tell us we were not watching.
    let windows: BlindWindow[] = []
    windows = noteFrame(windows, null, 1_000, GAP) // first frame ever
    expect(windows).toHaveLength(0)
    windows = noteFrame(windows, 1_000, 3_000, GAP) // normal 2s cadence
    expect(windows).toHaveLength(0)
    windows = noteFrame(windows, 3_000, 63_000, GAP) // a minute of nothing
    expect(windows).toEqual([[3_000, 63_000]])
  })

  it('reports an open window while the silence is still going on', () => {
    const windows: BlindWindow[] = []
    expect(blindNow(windows, 10_000, 12_000, GAP)).toHaveLength(0)
    expect(blindNow(windows, 10_000, 30_000, GAP)).toEqual([[10_000, null]])
    // Reading it must not mutate the stored windows.
    expect(windows).toHaveLength(0)
  })

  it('forgets windows that scrolled out of the live buffer', () => {
    const old: BlindWindow[] = [[0, 10_000]]
    const now = 25 * 60_000
    expect(noteFrame(old, now - 2_000, now, GAP)).toHaveLength(0)
  })

  it('leaves the windows it was given alone', () => {
    // The store reassigns the result, but a caller that keeps the old array must not see it
    // change under them — and nothing stored here is ever left open.
    const kept: BlindWindow[] = [[1_000, 2_000]]
    const next = noteFrame(kept, 3_000, 63_000, GAP)
    expect(kept).toEqual([[1_000, 2_000]])
    expect(next).toEqual([[1_000, 2_000], [3_000, 63_000]])
    expect(next.every(([, end]) => end !== null)).toBe(true)
  })
})

describe('reportRun and blind windows', () => {
  it('blames the node for silence only while we were listening', () => {
    const now = 1_200_000
    // One sample 10 minutes ago, then nothing: without context that reads as an outage.
    const points = [point(now - 600_000)]
    const plain = reportRun(points, 10, 10, now)
    expect(plain.filter((v) => v === false).length).toBeGreaterThan(0)

    // With the socket down for that whole stretch, the same gap is "we were not watching".
    const blind = reportRun(points, 10, 10, now, [[now - 590_000, null]])
    expect(blind.filter((v) => v === false)).toHaveLength(0)
    expect(blind.filter((v) => v === null).length).toBeGreaterThan(0)
  })

  it('still reports silence once the connection is back', () => {
    const now = 1_200_000
    const points = [point(now - 600_000)]
    // Blind for one minute early on; the rest of the gap is the node's own silence.
    const run = reportRun(points, 10, 10, now, [[now - 590_000, now - 540_000]])
    expect(run.filter((v) => v === false).length).toBeGreaterThan(0)
  })
})

describe('liveSpanMinutes', () => {
  it('stretches to the history that exists, capped at the window', () => {
    const now = 1_000_000
    expect(liveSpanMinutes([], 15, now)).toBe(15) // nothing yet: keep the full frame
    expect(liveSpanMinutes([point(now - 120_000), point(now)], 15, now)).toBeCloseTo(2, 1)
    expect(liveSpanMinutes([point(now - 60 * 60_000), point(now)], 15, now)).toBe(15)
    expect(liveSpanMinutes([point(now - 5_000), point(now)], 15, now)).toBe(1) // never below a minute
  })
})

describe('focusPoints', () => {
  it('finds the peak and the latest reading', () => {
    const f = focusPoints([{ at: 0, value: 2 }, { at: 1, value: 9 }, { at: 2, value: null }, { at: 3, value: 4 }])
    expect(f).toMatchObject({ peak: 9, peakIndex: 1, lastIndex: 3, current: 4 })
  })

  it('survives an all-empty series', () => {
    expect(focusPoints([{ at: 0, value: null }])).toMatchObject({ peak: 0, peakIndex: -1, lastIndex: -1, current: 0 })
  })
})

describe('coreTicks', () => {
  it('reads percent as cores busy', () => {
    expect(coreTicks(37, 4)).toMatchObject({ ticks: 4 })
    expect(coreTicks(37, 4).filled).toBeCloseTo(1.48, 2)
    expect(coreTicks(100, 16)).toMatchObject({ ticks: 16, filled: 16 })
  })

  it('falls back to ten ticks without a core count', () => {
    expect(coreTicks(50, 0)).toMatchObject({ ticks: 10, filled: 5 })
    expect(coreTicks(50, 128).ticks).toBe(10)
  })
})

describe('fitCells', () => {
  /** What the instrument actually draws, which is what has to fit. */
  const drawn = (box: number, cells: number, gap: number, max: number, extra = 0) =>
    cells * fitCells(box, cells, gap, max, 1, extra) + (cells - 1) * gap + extra

  it('keeps the drawn width inside the box', () => {
    // The ledger memory slot is 76px. Twelve blocks plus a swap pair at full size wanted
    // 143px and landed on the CPU percentage; every one of these must now fit.
    // `extra` is what BlockGrid passes: 0 without swap, and 5 with it — the 3px spacer plus
    // the 2px gap that spacer earns by being a flex child of its own.
    for (const cells of [1, 4, 8, 12, 14, 16]) {
      for (const extra of [0, 5]) {
        expect(drawn(76, cells, 2, 8, extra)).toBeLessThanOrEqual(76)
      }
    }
    expect(drawn(34, 4, 2, 8)).toBeLessThanOrEqual(34)
    expect(drawn(150, 17, 2, 13, 5)).toBeLessThanOrEqual(150)
  })

  it('does not stretch a few cells to fill the box', () => {
    expect(fitCells(150, 2, 2, 13)).toBe(13)
  })

  it('never collapses a cell to nothing', () => {
    expect(fitCells(10, 40, 2, 8)).toBeGreaterThanOrEqual(1)
  })
})

describe('memoryBlocks', () => {
  const GB = 1024 ** 3

  it('gives one block per GB up to 16 GB', () => {
    const m = memoryBlocks(5.8 * GB, 8 * GB)
    expect(m).toMatchObject({ blocks: 8, perBlock: 1 })
    expect(m.filled).toBeCloseTo(5.8, 1)
  })

  it('scales blocks for large machines and counts swap separately', () => {
    expect(memoryBlocks(16 * GB, 32 * GB).perBlock).toBe(4)
    expect(memoryBlocks(1 * GB, 8 * GB, 2 * GB).swapBlocks).toBeGreaterThan(0)
    expect(memoryBlocks(1 * GB, 8 * GB).swapBlocks).toBe(0)
  })
})
