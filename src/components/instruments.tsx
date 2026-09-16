import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { formatPercent } from '@/core/format'
import type { Bucket } from '@/core/live'
import { fitCells, focusPoints } from '@/core/live'

/**
 * The five instruments. Each one owns exactly one kind of meaning, so no two readings on a
 * row ever look alike:
 *
 *   ticks  → share of capacity (CPU, one tick per core)
 *   blocks → countable amount (memory, one block per GB)
 *   spark  → trend over time (network, mirrored around a baseline)
 *   run    → history of a state (reported / silent)
 *   notch  → a threshold, drawn on top of whichever instrument it belongs to
 *
 * All of them are plain SVG/CSS, sized in pixels, with no observers and no chart library.
 */

export type Level = 'good' | 'warn' | 'danger'

/**
 * Green (good) needs no action, yellow (warn) needs attention, red (danger) needs handling.
 * Warn/danger thresholds are CPU 50/85%, memory 70/90%, and disk 80/92%. Judge the figure
 * the reader sees: a disk at 91.6% is printed "92%" and must already be red.
 */
export const levelFor = (kind: 'cpu' | 'memory' | 'disk', percent: number): Level => {
  const [warn, danger] = kind === 'cpu' ? [50, 85] : kind === 'memory' ? [70, 90] : [80, 92]
  const shown = Number(formatPercent(percent))
  return shown >= danger ? 'danger' : shown >= warn ? 'warn' : 'good'
}

const LEVEL_COLOR: Record<Level, string> = {
  good: 'var(--good)',
  warn: 'var(--warn-fill)',
  danger: 'var(--danger)',
}

/* ---------- motion: a reading sweeps through its cells ---------- */

/** A sweep moves at one cell per SWEEP_CELL_MS, and never takes less than SWEEP_MIN_MS or more than SWEEP_MS. */
const SWEEP_MS = 700
const SWEEP_CELL_MS = 140
const SWEEP_MIN_MS = 200

/**
 * When a reading moves from 3.5 cells to 5.5, cells 4, 5 and 6 should fill one after another at
 * one steady speed — not all at once, each by its own amount, which reads as a staircase until
 * the last frame. Each cell gets the slice of the sweep it covers: a delay for where its segment
 * starts in the move, and a duration for how much of the move it holds. Shrinking runs the same
 * way from the right. Timing is linear and the speed is constant — a two-cell move takes 280ms, a
 * nudge within one cell 200ms rather than crawling for the full 700ms — capped at SWEEP_MS.
 */
function useSweep(filled: number, animate: boolean) {
  const previous = useRef(filled)
  const from = previous.current
  useEffect(() => {
    previous.current = filled
  }, [filled])
  return (i: number): CSSProperties | undefined => {
    if (!animate || from === filled) return undefined
    const lo = Math.min(from, filled)
    const hi = Math.max(from, filled)
    const span = hi - lo
    const start = Math.max(i, lo)
    const end = Math.min(i + 1, hi)
    if (end <= start) return { '--sweep-duration': '0ms', '--sweep-delay': '0ms' } as CSSProperties
    const total = Math.min(SWEEP_MS, Math.max(SWEEP_MIN_MS, span * SWEEP_CELL_MS))
    const delay = filled > from ? (start - lo) / span : (hi - end) / span
    return {
      '--sweep-duration': `${Math.round(((end - start) / span) * total)}ms`,
      '--sweep-delay': `${Math.round(delay * total)}ms`,
    } as CSSProperties
  }
}

/* ---------- ticks: CPU as cores busy ---------- */

export function TickBar({
  filled,
  ticks,
  level = 'good',
  notch,
  height = 11,
  width,
  gap: gapOverride,
  stretch = false,
  animate = false,
  label,
}: {
  filled: number
  ticks: number
  level?: Level
  /** 0–1 position of a threshold marker, e.g. load1 / cores. */
  notch?: number
  height?: number
  /** Enlarged readings (the node page) set their own tick geometry. */
  width?: number
  gap?: number
  /**
   * Fill the parent's width with equal ticks. A card's column is as wide as the card allows —
   * 71px in a four-up row, 110px on a phone — and a fixed pixel box either spills or strands.
   */
  stretch?: boolean
  animate?: boolean
  label?: string
}) {
  const color = LEVEL_COLOR[level]
  // Many cores must still fit one column, so the ticks thin out instead of the row growing.
  // The ledger box is 68px: 32 ticks at 1.5+1 would need 79px, hence the tighter steps.
  const gap = gapOverride ?? (ticks <= 20 ? 2 : 1)
  const tickWidth = width ?? fitCells(68, ticks, gap, 3)
  const sweep = useSweep(filled, animate)
  return (
    <span
      className={`relative items-end ${stretch ? 'flex w-full' : 'inline-flex'}`}
      style={{ height, gap }}
      data-instrument="ticks"
      data-level={level}
      data-animate={animate ? '' : undefined}
      data-filled={filled.toFixed(2)}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const fill = Math.max(0, Math.min(1, filled - i))
        return (
          <span
            key={i}
            className={`cell-empty rounded-[1px] ${stretch ? 'min-w-0 flex-1' : ''}`}
            style={{
              width: stretch ? undefined : tickWidth,
              height,
            }}
          >
            <span className="cell-fill" style={{ backgroundColor: color, transform: `scaleX(${fill})`, ...sweep(i) }} />
          </span>
        )
      })}
      {notch !== undefined && notch >= 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-[-3px] bottom-[-3px] z-10 w-px"
          style={{ left: `${Math.min(100, notch * 100)}%`, background: 'var(--line-strong)' }}
        />
      )}
    </span>
  )
}

/* ---------- blocks: memory as countable units ---------- */

export function BlockGrid({
  filled,
  blocks,
  swapBlocks = 0,
  level = 'good',
  height = 11,
  box,
  fill = false,
  stretch = false,
  animate = false,
  label,
}: {
  filled: number
  blocks: number
  swapBlocks?: number
  level?: Level
  height?: number
  /**
   * Width the caller can spare. Blocks shrink to fit it instead of spilling sideways: a
   * 64 GB box with swap asks for seventeen cells, which at full size is twice the column it
   * sits in, and what spills lands on the neighbouring reading. Same budget rule as TickBar.
   */
  box?: number
  /**
   * Spend the whole box instead of stopping where the square cells end. A card puts three of
   * these under three numbers, and cells sized by content leave a 1 GB machine showing one
   * speck against a 12-block neighbour. Filling makes every reading the same length, and the
   * count of divisions still carries the capacity.
   */
  fill?: boolean
  /** Fill the parent's width with equal cells, as TickBar does. Cards only; no swap group. */
  stretch?: boolean
  animate?: boolean
  label?: string
}) {
  const color = LEVEL_COLOR[level]
  const cells = blocks + swapBlocks
  // The swap group is set off by a 3px spacer, and that spacer is itself a flex child: it
  // costs its own width *and* one more 2px gap. Counting only the 3px left the blocks 2px
  // wider than their slot, which is how this overflowed a second time.
  const extra = swapBlocks > 0 ? 3 + 2 : 0
  const h = height - 3
  const w = box ? fitCells(box, cells, 2, fill ? box : h, fill ? 1 : 2, extra) : h
  const sweep = useSweep(filled, animate)
  return (
    <span
      className={`items-end gap-[2px] ${stretch ? 'flex w-full' : 'inline-flex'}`}
      style={{ height }}
      data-instrument="blocks"
      data-level={level}
      data-animate={animate ? '' : undefined}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: blocks }, (_, i) => {
        const cellFill = Math.max(0, Math.min(1, filled - i))
        return (
          <span
            key={i}
            className={`cell-empty rounded-[1px] ${stretch ? 'min-w-0 flex-1' : ''}`}
            style={{
              width: stretch ? undefined : w,
              height: h,
            }}
          >
            <span className="cell-fill" style={{ backgroundColor: color, transform: `scaleX(${cellFill})`, ...sweep(i) }} />
          </span>
        )
      })}
      {swapBlocks > 0 && (
        <>
          <span className="w-[3px]" aria-hidden />
          {Array.from({ length: swapBlocks }, (_, i) => (
            <span key={`s${i}`} className="cell-empty rounded-[1px]" style={{ width: w, height: h, background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--line-strong)' }}>
              <span className="cell-fill" style={{ backgroundColor: color, transform: 'scaleX(0)' }} />
            </span>
          ))}
        </>
      )}
    </span>
  )
}

/* ---------- spark: network mirrored around a baseline ---------- */

function seriesPath(buckets: readonly Bucket[], max: number, width: number, half: number, down: boolean) {
  if (!buckets.length || max <= 0) return { line: '', area: '' }
  const step = width / Math.max(1, buckets.length - 1)
  const y = (v: number) => (down ? half + (v / max) * (half - 1) : half - (v / max) * (half - 1))
  let line = ''
  let area = ''
  let open = false
  let startX = 0
  let lastX = 0
  buckets.forEach((b, i) => {
    const x = i * step
    if (b.value === null) {
      if (open) area += `L${lastX.toFixed(1)},${half}L${startX.toFixed(1)},${half}Z`
      open = false
      return
    }
    const py = y(b.value).toFixed(1)
    if (!open) {
      line += `M${x.toFixed(1)},${py}`
      area += `M${x.toFixed(1)},${py}`
      startX = x
      open = true
    } else {
      line += `L${x.toFixed(1)},${py}`
      area += `L${x.toFixed(1)},${py}`
    }
    lastX = x
  })
  if (open) area += `L${lastX.toFixed(1)},${half}L${startX.toFixed(1)},${half}Z`
  return { line, area }
}

/**
 * Upload above the line, download mirrored below it: direction carries the meaning, so the
 * two series stay apart without a second colour.
 *
 * Both halves share one scale by default. Scaling each half to its own peak makes 100 KB/s
 * of upload look exactly like 10 MB/s of download, which is the kind of quiet lie a monitor
 * must not tell. The cost is that a 1:100 ratio leaves the small side flat against the
 * baseline — the numbers beside the spark carry the magnitude. `independentScales` trades
 * that comparison away for shape, and a caller using it owes the reader both peaks.
 */
export function MirrorSpark({
  up,
  down,
  width = 72,
  height = 22,
  label,
  className = '',
  independentScales = false,
  stretch = false,
}: {
  up: readonly Bucket[]
  down: readonly Bucket[]
  width?: number
  height?: number
  label?: string
  /** Phones hide the waveform: ~40px of width carries no readable shape. */
  className?: string
  independentScales?: boolean
  /**
   * Fill the parent's width. The shape is drawn in `width` units and stretched horizontally;
   * strokes keep their 1px weight and the end dots stay round, because both are drawn with
   * non-scaling strokes rather than filled circles.
   */
  stretch?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const half = height / 2
  const upFocus = focusPoints(up)
  const downFocus = focusPoints(down)
  const shared = Math.max(upFocus.peak, downFocus.peak, 1)
  const upMax = independentScales ? Math.max(upFocus.peak, 1) : shared
  const downMax = independentScales ? Math.max(downFocus.peak, 1) : shared
  const u = seriesPath(up, upMax, width, half, false)
  const d = seriesPath(down, downMax, width, half, true)
  // The buffer fills from page load; until there is a shape to show, stay blank rather than
  // drawing a lone baseline that reads as a stray rule.
  const warming = upFocus.lastIndex < 0 && downFocus.lastIndex < 0
  const step = width / Math.max(1, up.length - 1)
  const dot = (buckets: readonly Bucket[], focus: ReturnType<typeof focusPoints>, max: number, isDown: boolean) => {
    if (focus.lastIndex < 0) return null
    const value = buckets[focus.lastIndex].value ?? 0
    const cy = isDown ? half + (value / max) * (half - 1) : half - (value / max) * (half - 1)
    const cx = (focus.lastIndex * step).toFixed(1)
    // A zero-length line with a round cap is a dot that survives a horizontal stretch.
    return stretch ? (
      <line x1={cx} x2={cx} y1={cy.toFixed(1)} y2={cy.toFixed(1)} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeWidth={3.2} style={{ stroke: 'var(--ink)' }} />
    ) : (
      <circle cx={cx} cy={cy.toFixed(1)} r={1.6} style={{ fill: 'var(--ink)' }} />
    )
  }
  const nonScaling = stretch ? 'non-scaling-stroke' : undefined

  return (
    <svg
      width={stretch ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={stretch ? 'none' : undefined}
      className={`block overflow-visible ${className}`}
      data-instrument="spark"
      role="img"
      aria-label={label}
    >
      {!warming && <line x1="0" x2={width} y1={half} y2={half} vectorEffect={nonScaling} style={{ stroke: 'var(--line)' }} shapeRendering="crispEdges" />}
      <path d={u.area} style={{ fill: 'var(--ink)', fillOpacity: 0.08 }} />
      <path d={d.area} style={{ fill: 'var(--ink)', fillOpacity: 0.05 }} />
      <path d={u.line} fill="none" vectorEffect={nonScaling} style={{ stroke: 'var(--ink)' }} strokeWidth={1} strokeLinejoin="round" id={`${id}-u`} />
      <path d={d.line} fill="none" vectorEffect={nonScaling} style={{ stroke: 'var(--muted)' }} strokeWidth={1} strokeLinejoin="round" />
      {dot(up, upFocus, upMax, false)}
      {dot(down, downFocus, downMax, true)}
    </svg>
  )
}

/* ---------- run: did it report, bucket by bucket ---------- */

export function DotRun({ run, size = 3, gap = 2, label }: { run: readonly (boolean | null)[]; size?: number; gap?: number; label?: string }) {
  // Drop the "not watching yet" head so the run grows leftward from now instead of showing
  // a long dotted rule while the buffer fills.
  const first = run.findIndex((v) => v !== null)
  const cells = first < 0 ? [] : run.slice(first)
  // No trailing gap: with one, rows holding different cell counts end at different x and the
  // column stops being a column.
  const width = Math.max(size, cells.length * size + Math.max(0, cells.length - 1) * gap)
  // Capsules, not dots: taller than wide keeps the run from reading as a dotted rule, and
  // keeps it distinct from the CPU ticks, which are thin and full height.
  const height = size * 2.2
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      data-instrument="run"
      role="img"
      aria-label={label}
    >
      {cells.map((state, i) => {
        const cx = i * (size + gap) + size / 2
        // A gap inside the run still shows as absence, not as a cell.
        if (state === null) return <circle key={i} cx={cx} cy={height / 2} r={0.6} style={{ fill: 'var(--line)' }} />
        return state ? (
          <rect key={i} x={cx - size / 2} y={1} width={size} height={height - 2} rx={size / 2} style={{ fill: 'var(--sage-text)' }} />
        ) : (
          <rect
            key={i}
            x={cx - size / 2 + 0.5}
            y={1.5}
            width={size - 1}
            height={height - 3}
            rx={(size - 1) / 2}
            fill="none"
            style={{ stroke: 'var(--danger)' }}
            strokeWidth={1}
          />
        )
      })}
    </svg>
  )
}
