#!/usr/bin/env node
// Is a backend's 7-day history dense enough for the hourly reporting grid?
//
// The grid draws one cell per hour, so the question is whether the *median* sampling
// interval is an hour or better. A long gap is not a defect — it is usually a real outage,
// which is exactly what the grid exists to show. Judging "any gap > 1h" as a failure, as a
// first version of this check did, reports real incidents as broken plumbing.
//
//   node scripts/check-history-resolution.mjs https://komari.example.com [nodes]
import { argv, exit } from 'node:process'

const base = argv[2]
const sample = Number(argv[3] ?? 6)
if (!base) {
  console.error('usage: check-history-resolution.mjs <komari base url> [node count]')
  exit(2)
}

const json = async (path) => {
  const res = await fetch(new URL(path, base))
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  return res.json()
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const hours = (ms) => (ms / 3_600_000).toFixed(1)

const nodes = (await json('/api/nodes')).data.filter((n) => !n.hidden).slice(0, sample)
if (!nodes.length) {
  console.error('no visible nodes')
  exit(2)
}

let worstMedian = 0
const gaps = []

for (const node of nodes) {
  const { data } = await json(`/api/records/load?uuid=${encodeURIComponent(node.uuid)}&hours=168`)
  const times = (data.records ?? []).map((r) => Date.parse(r.time)).sort((a, b) => a - b)
  if (times.length < 3) {
    console.log(`${node.uuid.slice(0, 8)}  too few points (${times.length}) — node may be new`)
    continue
  }
  const steps = times.slice(1).map((t, i) => t - times[i])
  const med = median(steps)
  worstMedian = Math.max(worstMedian, med)
  const long = steps
    .map((s, i) => [times[i], s])
    .filter(([, s]) => s > 3_700_000)
    .map(([at, s]) => `${new Date(at).toISOString().slice(5, 16)}Z +${hours(s)}h`)
  gaps.push(...long)
  console.log(
    `${node.uuid.slice(0, 8)}  ${String(times.length).padStart(4)} points  median ${(med / 60_000).toFixed(0)} min` +
      (long.length ? `  gaps: ${long.join(', ')}` : '  no gaps'),
  )
}

const ok = worstMedian <= 3_700_000
console.log(`\nmedian interval across nodes: ${(worstMedian / 60_000).toFixed(0)} min — ${ok ? 'dense enough for an hourly grid' : 'TOO COARSE'}`)
if (gaps.length) {
  console.log('Gaps above are candidate outages. Check them against your incident log before')
  console.log('calling them a data problem; the grid is meant to show real downtime.')
}
exit(ok ? 0 : 1)
