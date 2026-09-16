import type { NodeInfo } from './model'

/**
 * The home page filter: which groups and which region the visitor has picked.
 *
 * It lives in the query string first, so a filtered page can be shared and survives a reload,
 * and in localStorage second, so coming back to the bare address keeps the last choice.
 * Groups are repeated parameters (`?group=a&group=b`) rather than one joined value: group
 * names are free text and may contain any separator we could pick.
 */
export interface Filter {
  /** Picked group names. `''` stands for nodes without a group. */
  groups: string[]
  region: string | null
}

export const EMPTY_FILTER: Filter = { groups: [], region: null }

/** Reads the filter from a query string. A key that is absent comes back as `undefined`. */
export function parseFilterQuery(search: string): { groups?: string[]; region?: string | null } {
  const q = new URLSearchParams(search)
  const out: { groups?: string[]; region?: string | null } = {}
  if (q.has('group')) out.groups = unique(q.getAll('group'))
  if (q.has('region')) out.region = q.get('region') || null
  return out
}

/** Writes the filter into a query string, keeping every unrelated parameter as it was. */
export function serializeFilterQuery(search: string, filter: Filter): string {
  const q = new URLSearchParams(search)
  q.delete('group')
  q.delete('region')
  for (const g of filter.groups) q.append('group', g)
  if (filter.region) q.set('region', filter.region)
  const s = q.toString()
  return s ? `?${s}` : ''
}

const unique = (xs: string[]) => [...new Set(xs)]

/** The group a node is filed under when nothing more specific applies. */
const groupsOf = (n: NodeInfo) => (n.groups.length ? n.groups : [''])

/** True when the node belongs to any picked group; no picked groups means every node. */
export function matchGroups(node: NodeInfo, picked: readonly string[]) {
  if (!picked.length) return true
  return groupsOf(node).some((g) => picked.includes(g))
}

export interface Section {
  /** `''` is the ungrouped section, and also the single unnamed section of a flat page. */
  name: string
  /** Whether the page draws a heading for it. A flat page has one section and no heading. */
  titled: boolean
  nodes: NodeInfo[]
}

/**
 * Splits the visible nodes into sections.
 *
 * - no groups picked: one flat section, or one per first membership when grouped;
 * - one group picked: that group, flat — a heading over the only section says nothing;
 * - several picked: their union in one flat section, or, when grouped, one section per
 *   picked group, each node once, in the first picked group (by page order) it belongs to.
 *
 * Section order follows the lightest node in it, the same order groups have always had.
 * Nodes without a group use the empty-name section; a sole section has no heading.
 */
export function sectionize(nodes: readonly NodeInfo[], picked: readonly string[], grouped: boolean): Section[] {
  const matched = nodes.filter((n) => matchGroups(n, picked))
  const bySection = grouped && picked.length !== 1
  if (!bySection) return matched.length ? [{ name: '', titled: false, nodes: matched }] : []

  const order = picked.length ? pageOrder(nodes, picked) : null
  const buckets = new Map<string, NodeInfo[]>()
  for (const n of matched) {
    const own = groupsOf(n)
    const key = order ? (order.find((g) => own.includes(g)) ?? '') : own[0]
    buckets.set(key, [...(buckets.get(key) ?? []), n])
  }
  // Two picked groups can still end in one section, when every node of one also belongs to the
  // other and is filed under it. A heading over the only section says nothing, so there is none.
  const titled = buckets.size > 1
  return [...buckets.entries()]
    .sort((a, b) => lightest(a[1]) - lightest(b[1]) || a[0].localeCompare(b[0]))
    .map(([name, members]) => ({ name, titled, nodes: members }))
}

const lightest = (ns: NodeInfo[]) => Math.min(...ns.map((n) => n.weight))

/** Picked groups sorted the way their sections will be drawn. */
function pageOrder(nodes: readonly NodeInfo[], picked: readonly string[]) {
  const weight = (g: string) => lightest(nodes.filter((n) => groupsOf(n).includes(g)).concat([{ weight: Infinity } as NodeInfo]))
  return [...picked].sort((a, b) => weight(a) - weight(b) || a.localeCompare(b))
}

/** Every group on the page with how many nodes it holds, in page order. */
export function groupCounts(nodes: readonly NodeInfo[]): [string, number][] {
  const counts = new Map<string, { count: number; weight: number }>()
  for (const n of nodes) {
    for (const g of groupsOf(n)) {
      const c = counts.get(g) ?? { count: 0, weight: Infinity }
      counts.set(g, { count: c.count + 1, weight: Math.min(c.weight, n.weight) })
    }
  }
  return [...counts.entries()]
    .sort((a, b) => a[1].weight - b[1].weight || a[0].localeCompare(b[0]))
    .map(([g, c]) => [g, c.count])
}
