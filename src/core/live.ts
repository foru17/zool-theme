import type { HistoryPoint, Snapshot } from './model'

/**
 * Turning the live ring buffer into the shapes the instruments draw.
 *
 * The buffer holds up to 450 points at a ~2 s cadence (15 minutes). Instruments need far
 * fewer: a strip is ~64 px wide, so anything beyond ~60 points is invisible work. These
 * functions are pure so they can be tested without a browser.
 */

export interface Bucket {
  /** Bucket start, epoch ms. */
  at: number
  /** Average of the samples that landed in the bucket, or null when none did. */
  value: number | null
}

/**
 * Splits `[from, to]` into `count` equal buckets and averages each one. Buckets without a
 * sample stay `null` — that is what makes a gap visible instead of interpolated away.
 */
export function bucketSeries(
  points: readonly HistoryPoint[],
  pick: (p: HistoryPoint) => number,
  count: number,
  from: number,
  to: number,
): Bucket[] {
  const span = Math.max(1, to - from)
  const width = span / count
  const sums = new Float64Array(count)
  const hits = new Int32Array(count)
  for (const p of points) {
    if (p.at < from || p.at > to) continue
    const i = Math.min(count - 1, Math.floor((p.at - from) / width))
    sums[i] += pick(p)
    hits[i]++
  }
  return Array.from({ length: count }, (_, i) => ({
    at: from + i * width,
    value: hits[i] ? sums[i] / hits[i] : null,
  }))
}

export type BlindWindow = [start: number, end: number | null]

/**
 * Spans where this client received nothing. Derived from the arrival of frames rather than
 * from socket state, because the ways of not seeing a node are wider than a closed socket:
 * a backgrounded tab stops asking while the socket stays open, and a sleeping laptop only
 * reports the close on wake. Anything the node did while we were not looking is unknown,
 * never "down".
 */
export function noteFrame(windows: readonly BlindWindow[], lastFrameAt: number | null, at: number, gapMs: number): BlindWindow[] {
  // Stored windows are always closed. The one still running is never kept here: `blindNow`
  // derives it at read time from the silence since the last frame, because only the next
  // frame can say where it ended — and this call is that frame.
  const closed = lastFrameAt !== null && at - lastFrameAt > gapMs ? [...windows, [lastFrameAt, at] as BlindWindow] : windows
  // Forget windows that have scrolled out of the live buffer instead of counting them.
  return closed.filter(([, end]) => end === null || end > at - 20 * 60_000)
}

/** The windows to paint as "not watching", including one still open right now. */
export function blindNow(windows: readonly BlindWindow[], lastFrameAt: number | null, now: number, gapMs: number): BlindWindow[] {
  const out = windows.map((w) => [...w] as BlindWindow)
  if (lastFrameAt !== null && now - lastFrameAt > gapMs) out.push([lastFrameAt, null])
  return out
}

/**
 * How much history the buffer actually holds, capped at `max`. The instruments stretch to
 * what exists instead of drawing one dot in a fifteen-minute frame right after page load.
 */
export function liveSpanMinutes(points: readonly HistoryPoint[], max: number, now = Date.now()) {
  if (points.length < 2) return max
  const elapsed = (now - points[0].at) / 60_000
  return Math.min(max, Math.max(1, elapsed))
}

/** Convenience wrapper: the last `minutes` of the buffer, ending now. */
export const recentBuckets = (
  points: readonly HistoryPoint[],
  pick: (p: HistoryPoint) => number,
  count: number,
  minutes: number,
  now = Date.now(),
) => bucketSeries(points, pick, count, now - minutes * 60_000, now)

/**
 * The status run: one cell per bucket, filled when the node reported in that window.
 * `true` = reported, `false` = silent. Buckets before the node was first seen are `null`
 * so "we were not watching" never looks like "it was down".
 */
export function reportRun(
  points: readonly HistoryPoint[],
  count: number,
  minutes: number,
  now = Date.now(),
  /** Spans where this client was not listening; an open end means "still not listening". */
  blind: readonly (readonly [number, number | null])[] = [],
): (boolean | null)[] {
  const from = now - minutes * 60_000
  const width = (now - from) / count
  const first = points.length ? points[0].at : now
  return bucketSeries(points, (p) => p.at, count, from, now).map((b) => {
    if (b.at < first - 1000) return null
    if (b.value !== null) return true
    // Silence only counts against the node when we were actually listening.
    const end = b.at + width
    const deaf = blind.some(([s, e]) => s < end && (e === null || e > b.at))
    return deaf ? null : false
  })
}

/** Peak and current value of a bucketed series, for the two dots every sparkline gets. */
export function focusPoints(buckets: readonly Bucket[]) {
  let peak = -1
  let peakIndex = -1
  let lastIndex = -1
  buckets.forEach((b, i) => {
    if (b.value === null) return
    lastIndex = i
    if (b.value > peak) {
      peak = b.value
      peakIndex = i
    }
  })
  return { peak: peak < 0 ? 0 : peak, peakIndex, lastIndex, current: lastIndex < 0 ? 0 : (buckets[lastIndex].value ?? 0) }
}

/**
 * CPU as "cores busy": a 4-core box at 37% fills 1.48 of 4 ticks. Without per-core data
 * from either backend this is the most honest core-level reading available.
 */
export function coreTicks(cpuPercent: number, cores: number, maxTicks = 32) {
  const ticks = cores > 0 && cores <= maxTicks ? cores : Math.min(10, maxTicks)
  const filled = Math.max(0, Math.min(ticks, (cpuPercent / 100) * ticks))
  return { ticks, filled }
}

/**
 * How wide each cell of an instrument may be so that `cells` of them, their gaps and any
 * fixed `extra` still fit inside `box` pixels.
 *
 * Instruments shrink instead of spilling. What spills does not stop at the edge of its own
 * reading: a 64 GB node with swap asked for sixteen memory blocks, drew 143px into a 76px
 * slot, and landed on the CPU percentage two columns over.
 */
export function fitCells(box: number, cells: number, gap: number, max: number, min = 1, extra = 0) {
  if (cells <= 0) return max
  return Math.max(min, Math.min(max, (box - extra - (cells - 1) * gap) / cells))
}

/** Memory as countable blocks. Above 16 GB one block covers more than a gigabyte. */
const BLOCK_STEPS = [1, 2, 4, 8, 16, 32, 64]

/**
 * Memory as countable blocks, kept to at most 12 so a row stays scannable: 1 GB each on a
 * small box, 4 GB each on a 48 GB one. The step is announced next to the instrument.
 */
export function memoryBlocks(usedBytes: number, totalBytes: number, swapTotal = 0, maxBlocks = 12) {
  const GB = 1024 ** 3
  const totalGb = Math.max(0, totalBytes / GB)
  const perBlock = BLOCK_STEPS.find((step) => totalGb / step <= maxBlocks) ?? 128
  const blocks = Math.max(1, Math.min(maxBlocks, Math.round(totalGb / perBlock) || 1))
  const filled = totalBytes > 0 ? Math.max(0, Math.min(blocks, (usedBytes / totalBytes) * blocks)) : 0
  return { blocks, filled, perBlock, swapBlocks: swapTotal > 0 ? Math.max(1, Math.min(4, Math.round(swapTotal / GB / perBlock))) : 0 }
}

/** Snapshot → the single history point the live buffer stores. */
export const pointFromSnapshot = (s: Snapshot): HistoryPoint => ({
  at: s.at,
  cpu: s.cpu,
  memUsed: s.memUsed,
  swapUsed: s.swapUsed,
  diskUsed: s.diskUsed,
  netUp: s.netUp,
  netDown: s.netDown,
  load1: s.load1,
  tcp: s.tcp,
  udp: s.udp,
  process: s.process,
})
