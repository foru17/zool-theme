import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownUp, Check, ChevronDown, LayoutGrid, List, ListTree, Rows2, Rows3 } from 'lucide-react'
import { adapter, useStore, useVisibleNodes } from '@/app/store'
import { setDensity, setGrouping, setView, useDensity, useGrouping, useView } from '@/app/prefs'
import type { Density, View } from '@/core/settings'
import type { NodeInfo, Snapshot } from '@/core/model'
import { formatMoney, formatPercent, monthlyCost, ratio, splitBytes, splitSpeed } from '@/core/format'
import { regionName, stripFlag } from '@/core/region'
import { Popover } from '@/components/Popover'
import { GroupHeading, NodeCard, NodeStrip } from '@/components/ledger'
import { levelFor, type Level } from '@/components/instruments'
import { RegionFlag, StatusDot } from '@/components/bits'
import { groupCounts, parseFilterQuery, sectionize, serializeFilterQuery, type Filter } from '@/core/filter'

/* ---------- sorting ---------- */

const SORT_KEYS = ['default', 'name', 'cpu', 'memory', 'network', 'traffic', 'uptime', 'expiry'] as const
type SortKey = (typeof SORT_KEYS)[number]
type Sort = { key: SortKey; desc: boolean }

const DEFAULT_DESC: Record<SortKey, boolean> = {
  default: false,
  name: false,
  cpu: true,
  memory: true,
  network: true,
  traffic: true,
  uptime: true,
  expiry: false,
}

function readSort(): Sort {
  try {
    const v = JSON.parse(localStorage.getItem('zool:sort') ?? '') as Sort
    if (SORT_KEYS.includes(v.key)) return v
  } catch {
    /* default */
  }
  return { key: 'default', desc: false }
}

function sortValue(key: SortKey, n: NodeInfo, s: Snapshot | undefined): number | string {
  switch (key) {
    case 'name':
      return stripFlag(n.name).toLowerCase()
    case 'cpu':
      return s?.online ? s.cpu : -1
    case 'memory':
      return s?.online ? ratio(s.memUsed, s.memTotal || n.memTotal) : -1
    case 'network':
      return s?.online ? s.netUp + s.netDown : -1
    case 'traffic':
      return s ? s.totalUp + s.totalDown : -1
    case 'uptime':
      return s?.online ? s.uptime : -1
    case 'expiry':
      return n.expiredAt ?? Number.MAX_SAFE_INTEGER
    default:
      return n.weight
  }
}

/* ---------- filter ---------- */

const FILTER_KEY = 'zool:filter'

/**
 * An address that carries any filter is taken whole: a shared link means exactly what it says,
 * and is not merged with whatever this visitor had picked before (a shared group plus a
 * remembered region can leave nothing to show). It also becomes the visitor's last choice.
 * Without one, the last choice comes back; without that, nothing is picked.
 */
function readFilter(): Filter {
  const q = parseFilterQuery(window.location.search)
  if (q.groups !== undefined || q.region !== undefined) {
    const fromLink = { groups: q.groups ?? [], region: q.region ?? null }
    remember(fromLink)
    return fromLink
  }
  let stored: Partial<Filter> = {}
  try {
    stored = JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}') as Partial<Filter>
  } catch {
    /* nothing stored */
  }
  return {
    groups: Array.isArray(stored.groups) ? stored.groups.filter((g): g is string => typeof g === 'string') : [],
    region: typeof stored.region === 'string' ? stored.region : null,
  }
}

function remember(filter: Filter) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filter))
  } catch {
    /* private mode */
  }
}

/** Puts the filter in the address without adding a history entry. */
function showInAddress(filter: Filter) {
  const { pathname, search, hash } = window.location
  const next = serializeFilterQuery(search, filter)
  if (next !== search) window.history.replaceState(window.history.state, '', `${pathname}${next}${hash}`)
}

/* ---------- overview ---------- */

/**
 * One figure in the overview band: a quiet label, the number, and the detail underneath.
 *
 * This is the top of the page, so it is the largest type on it — but only just. The headline
 * it replaces was 52px to say one sentence, which spent the most valuable part of the screen
 * on the least information. 24px is enough to lead.
 */
function Metric({
  label,
  value,
  sub,
  tone = '',
  className = '',
  subOnPhone = false,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: string
  className?: string
  /** On a phone the band is three narrow columns; only a sub line that names something keeps its place. */
  subOnPhone?: boolean
}) {
  // Before the first live frame every total is zero, and "0 / 17 online" in red is a false
  // alarm; the band waits with dashes in the same places instead.
  const fed = useStore((s) => s.fed)
  return (
    <div className={`min-w-0 py-3 md:py-4 lg:px-5 lg:py-5 lg:first:pl-0 ${className}`}>
      <p className="truncate text-[11px] text-muted md:text-[12px]">{label}</p>
      <p className={`num mt-1.5 truncate text-[20px] leading-none font-light tracking-[-0.025em] md:text-[24px] ${fed ? tone : 'text-faint'}`}>
        {fed ? value : '—'}
      </p>
      {sub ? <p className={`num mt-2 truncate text-[11px] text-muted ${subOnPhone ? '' : 'hidden md:block'}`}>{fed ? sub : '—'}</p> : null}
    </div>
  )
}

const Pair = ({ up, down }: { up: string; down: string }) => (
  <>
    ↑ {up} · ↓ {down}
  </>
)

/* ---------- page ---------- */

const anchorId = (group: string) => `group-${encodeURIComponent(group).replace(/%/g, '')}`

export function HomePage() {
  const { t, i18n } = useTranslation()
  const nodes = useVisibleNodes()
  const snapshots = useStore((s) => s.snapshots)
  const connection = useStore((s) => s.connection)
  const settings = useStore((s) => s.settings)
  const description = useStore((s) => s.site?.description)
  const tick = useStore((s) => s.liveVersion)
  const view = useView(settings.defaultView)
  const density = useDensity(settings.defaultDensity)
  const grouping = useGrouping(settings.defaultGrouped ? 'grouped' : 'flat')
  const [filter, setFilterState] = useState<Filter>(readFilter)
  const setFilter = (next: Filter) => {
    setFilterState(next)
    remember(next)
    showInAddress(next)
  }
  const [sort, setSortState] = useState<Sort>(readSort)

  const setSort = (next: Sort) => {
    setSortState(next)
    try {
      localStorage.setItem('zool:sort', JSON.stringify(next))
    } catch {
      /* private mode */
    }
  }

  const online = nodes.filter((n) => snapshots[n.id]?.online).length
  const offline = nodes.length - online
  const fed = useStore((s) => s.fed)

  /** Fleet totals for the summary line. */
  const totals = useMemo(() => {
    let up = 0
    let down = 0
    let trafficUp = 0
    let trafficDown = 0
    // Nodes with a reading past its own warning line, and the worst one of them. An average
    // across the fleet would be arithmetic without meaning — a 1-core VPS and a 16-core box
    // contribute equally to it — whereas this answers the only question a summary owes you.
    let attention = 0
    let worst: { name: string; metric: 'cpu' | 'memory' | 'disk'; pct: number; level: Level } | null = null
    const costs = new Map<string, [number, number]>()
    for (const n of nodes) {
      const s = snapshots[n.id]
      if (s?.online) {
        up += s.netUp
        down += s.netDown
        const readings = [
          ['cpu', s.cpu],
          ['memory', ratio(s.memUsed, s.memTotal || n.memTotal)],
          ['disk', ratio(s.diskUsed, s.diskTotal || n.diskTotal)],
        ] as const
        let flagged = false
        for (const [metric, pct] of readings) {
          const level = levelFor(metric, pct)
          if (level === 'good') continue
          flagged = true
          // Past its red line outranks further past an amber one: disk 91% is amber, CPU 86% is
          // red, and the red one is the worst. Thresholds differ per metric, so compare levels first.
          const rank = level === 'danger' ? 1 : 0
          const worstRank = worst?.level === 'danger' ? 1 : 0
          if (!worst || rank > worstRank || (rank === worstRank && pct > worst.pct)) worst = { name: n.name, metric, pct, level }
        }
        if (flagged) attention++
      }
      if (s) {
        trafficUp += s.totalUp
        trafficDown += s.totalDown
      }
      const m = monthlyCost(n.price, n.billingCycle)
      if (m > 0) {
        const [sum, count] = costs.get(n.currency) ?? [0, 0]
        costs.set(n.currency, [sum + m, count + 1])
      }
    }
    const lead = [...costs.entries()].sort((a, b) => b[1][1] - a[1][1])[0]
    return {
      up,
      down,
      trafficUp,
      trafficDown,
      traffic: trafficUp + trafficDown,
      attention,
      worst,
      regions: new Set(nodes.map((n) => n.region).filter(Boolean)).size,
      cost: lead ? formatMoney(lead[1][0], lead[0]) : '',
      paid: [...costs.values()].reduce((n2, [, c]) => n2 + c, 0),
    }
  }, [nodes, snapshots])

  const visible = useMemo(
    // Nodes still waiting for their first snapshot stay listed: hiding them would show an empty page.
    () => (settings.showOffline ? nodes : nodes.filter((n) => snapshots[n.id]?.online || (!fed && !snapshots[n.id]))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, fed, settings.showOffline, settings.showOffline ? 0 : online],
  )

  const regions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of visible) if (n.region) counts.set(n.region, (counts.get(n.region) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [visible])

  const groups = useMemo(() => groupCounts(visible), [visible])
  // A group offered only to be told "there are no groups" is noise: one bucket is no choice.
  const offerGroups = settings.showGroups && groups.length > 1
  const offerRegions = settings.showRegions && regions.length > 1

  // A saved or shared choice can name a group or region that is not on this page any more;
  // it is ignored rather than leaving the visitor looking at an empty page with no way back.
  const pickedGroups = useMemo(
    () => (offerGroups ? filter.groups.filter((g) => groups.some(([name]) => name === g)) : []),
    [offerGroups, filter.groups, groups],
  )
  const pickedRegion = offerRegions && filter.region && regions.some(([code]) => code === filter.region) ? filter.region : null
  const filtering = pickedGroups.length > 0 || pickedRegion !== null

  // Keep the address in step with what is shown once the page knows its groups and regions.
  // Only the address: what is ignored here may be back on the next update (a node whose first
  // snapshot has not arrived yet), so the visitor's own choice is never overwritten with it.
  useEffect(() => {
    if (!visible.length) return
    showInAddress({ groups: pickedGroups, region: pickedRegion })
  }, [visible.length, pickedGroups, pickedRegion])

  /** Sections keep their natural order (lightest node first); rows inside follow the sort. */
  const sections = useMemo(() => {
    const inRegion = pickedRegion ? visible.filter((n) => n.region === pickedRegion) : visible
    const dir = sort.desc ? -1 : 1
    return sectionize(inRegion, pickedGroups, offerGroups && grouping === 'grouped')
      .map(({ name, titled, nodes: members }) => {
        const rows = [...members].sort((a, b) => {
          const va = sortValue(sort.key, a, snapshots[a.id])
          const vb = sortValue(sort.key, b, snapshots[b.id])
          const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
          return c * dir || a.weight - b.weight || a.name.localeCompare(b.name)
        })
        let up = 0
        let down = 0
        for (const n of rows) {
          const s = snapshots[n.id]
          if (s?.online) {
            up += s.netUp
            down += s.netDown
          }
        }
        return { name, titled, rows, up, down }
      })
  }, [visible, pickedRegion, pickedGroups, offerGroups, grouping, sort, snapshots])

  const shown = sections.reduce((n, s) => n + s.rows.length, 0)

  return (
    <div className="wrap pt-10 md:pt-16">
      {/* headline */}
      <section className="fade-in">
        <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Until the first frame the dot is neutral whatever the socket is doing: red belongs to a
              connection that was working and dropped. */}
          <StatusDot online={connection === 'open' && fed} pending={!fed} />
          {connection === 'closed' && fed ? t('status.reconnecting') : connection === 'open' && fed ? t('status.live') : t('status.connecting')}
          {nodes.length > 0 && fed && (
            <>
              <span className="text-faint">/</span>
              {/* What used to be a 52px headline, at the size of a caption: it is one sentence,
                  and the overview beside it is what the top of the page is actually for. */}
              <span className={`normal-case tracking-normal ${offline ? 'text-danger' : ''}`}>
                {offline === 0 ? t('status.allOnline') : t('status.someOffline', { count: offline })}
              </span>
            </>
          )}
          {nodes.length === 0 && (
            <>
              <span className="text-faint">/</span>
              <span className="normal-case tracking-normal">{t('status.noNodes')}</span>
            </>
          )}
        </p>

        {/* The fleet at a glance. This is the top of the page, so it is the biggest type on
            it — but a band of figures, not one 52px sentence. */}
        {settings.showOverview && (
          <div
            className={`mt-4 grid grid-cols-3 gap-x-4 border-y border-line lg:gap-x-0 lg:divide-x lg:divide-line ${
              settings.showCost && totals.cost ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
            }`}
          >
            <Metric
              label={t('overview.nodes')}
              tone={offline ? 'text-danger' : ''}
              value={
                <>
                  {online}
                  <span className="ml-1 text-[0.55em] text-muted">/ {nodes.length}</span>
                </>
              }
              sub={totals.regions > 0 ? t('overview.regions', { count: totals.regions }) : undefined}
            />
            <Metric
              label={t('overview.bandwidth')}
              value={
                <>
                  {splitSpeed(totals.up + totals.down).value}
                  <span className="ml-1 text-[0.55em] text-muted">{splitSpeed(totals.up + totals.down).unit}</span>
                </>
              }
              sub={
                <Pair
                  up={`${splitSpeed(totals.up).value} ${splitSpeed(totals.up).unit}`}
                  down={`${splitSpeed(totals.down).value} ${splitSpeed(totals.down).unit}`}
                />
              }
            />
            <Metric
              label={t('overview.traffic')}
              value={
                <>
                  {splitBytes(totals.traffic).value}
                  <span className="ml-1 text-[0.55em] text-muted">{splitBytes(totals.traffic).unit}</span>
                </>
              }
              sub={
                <Pair
                  up={`${splitBytes(totals.trafficUp).value} ${splitBytes(totals.trafficUp).unit}`}
                  down={`${splitBytes(totals.trafficDown).value} ${splitBytes(totals.trafficDown).unit}`}
                />
              }
            />
            {/* Not an average. A mean CPU across a one-core VPS and a sixteen-core box is
                arithmetic without meaning; this counts the machines with a reading past its own
                warning line, which is the question a summary actually owes the reader. */}
            <Metric
              label={t('overview.attention')}
              className={settings.showCost && totals.cost ? 'col-span-2 lg:col-span-1' : 'col-span-3 lg:col-span-1'}
              subOnPhone
              tone={totals.worst?.level === 'danger' ? 'text-danger' : totals.worst ? 'text-warn' : ''}
              value={totals.attention}
              sub={
                totals.worst
                  ? `${stripFlag(totals.worst.name)} · ${t(`metric.${totals.worst.metric}`)} ${formatPercent(totals.worst.pct)}%`
                  : t('overview.allClear')
              }
            />
            {settings.showCost && totals.cost && (
              <Metric
                label={t('overview.cost')}
                value={
                  <>
                    {totals.cost}
                    <span className="ml-1 text-[0.55em] text-muted">{t('unit.perMonth')}</span>
                  </>
                }
                sub={t('overview.costNodes', { count: totals.paid })}
              />
            )}
          </div>
        )}
        {description && description !== 'A simple server monitor tool.' && (
          <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-muted">{description}</p>
        )}
      </section>

      {/* toolbar: one row from tablet width up — groups, regions, then how to sort and draw */}
      <section className="home-toolbar mt-8 flex flex-wrap items-center gap-2 md:flex-nowrap">
        {offerGroups && (
          <div className="segmented flex items-center rounded-full border border-line p-0.5">
            <Popover
              label={`${t('toolbar.groups')} ${pickedGroups.length || t('toolbar.all')}`}
              align="start"
              buttonClassName={`pill min-h-8 gap-1 border-0 px-2.5 sm:gap-1.5 sm:px-3 ${pickedGroups.length ? 'text-ink' : ''}`}
              button={
                <>
                  <span>{t('toolbar.groups')}</span>
                  <span className={`num text-muted ${pickedGroups.length ? '' : 'hidden sm:inline'}`}>{pickedGroups.length ? pickedGroups.length : t('toolbar.all')}</span>
                  <ChevronDown size={14} strokeWidth={1.7} className="text-muted" aria-hidden />
                </>
              }
              panelClassName="w-[240px] p-1.5"
            >
              {() => (
                <div>
                  <ul role="group" aria-label={t('toolbar.groups')} className="max-h-[min(60vh,360px)] overflow-y-auto">
                    {groups.map(([name, count]) => {
                      const on = pickedGroups.includes(name)
                      return (
                        <li key={name || 'ungrouped'}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[14px] hover:bg-wash"
                            onClick={() =>
                              setFilter({
                                groups: on ? pickedGroups.filter((g) => g !== name) : [...pickedGroups, name],
                                region: pickedRegion,
                              })
                            }
                          >
                            <span
                              className={`grid size-4 shrink-0 place-items-center rounded-[5px] border ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong'}`}
                              aria-hidden
                            >
                              {on && <Check size={12} strokeWidth={2.2} />}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{name || t('toolbar.ungrouped')}</span>
                            <span className="num text-[12px] text-muted">{count}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {pickedGroups.length > 0 && (
                    <button
                      type="button"
                      className="mt-1 flex h-9 w-full items-center rounded-[10px] border-t border-line px-3 text-left text-[13px] text-muted hover:text-ink"
                      onClick={() => setFilter({ groups: [], region: pickedRegion })}
                    >
                      {t('toolbar.showAll')}
                    </button>
                  )}
                </div>
              )}
            </Popover>
            <button
              type="button"
              aria-pressed={grouping === 'grouped'}
              title={t('toolbar.grouped')}
              aria-label={t('toolbar.grouped')}
              disabled={pickedGroups.length === 1}
              onClick={() => setGrouping(grouping === 'grouped' ? 'flat' : 'grouped')}
              className={`grid h-8 w-9 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                grouping === 'grouped' ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              }`}
            >
              <ListTree size={15} strokeWidth={1.7} aria-hidden />
            </button>
          </div>
        )}

        {offerRegions ? (
          // On a phone the strip gets a row of its own: squeezed between the group picker and
          // the view switch it had room for one pill, which reads as the only region there is.
          <div
            className="scroll-x order-last -ml-1 flex min-w-0 basis-full gap-1 py-1 pl-1 md:order-none md:flex-1 md:basis-auto"
            role="group"
            aria-label={t('toolbar.regions')}
          >
            {regions.map(([code, count]) => (
              <button
                key={code}
                type="button"
                className="pill min-h-8 shrink-0 gap-1.5 px-3 text-[12px]"
                aria-pressed={pickedRegion === code}
                title={regionName(code, i18n.language)}
                onClick={() => setFilter({ groups: pickedGroups, region: pickedRegion === code ? null : code })}
              >
                <RegionFlag code={code} />
                <span className="font-mono tracking-wide">{code}</span>
                <span className="num text-muted">{count}</span>
              </button>
            ))}
            {filtering && (
              <button
                type="button"
                className="pill min-h-8 shrink-0 px-3 text-[12px] underline-offset-4 hover:underline md:hidden"
                onClick={() => setFilter({ groups: [], region: null })}
              >
                {t('toolbar.clear')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {/* keeps sort and view at the right edge of the first row on a phone */}
        {offerRegions && <div className="flex-1 md:hidden" />}

        {/* On a phone this would push the view switch onto a row of its own; there it sits at
            the end of the region strip instead, below. */}
        {filtering && (
          <button
            type="button"
            className="pill hidden min-h-8 shrink-0 px-3 text-[12px] underline-offset-4 hover:underline md:inline-flex"
            onClick={() => setFilter({ groups: [], region: null })}
          >
            {t('toolbar.clear')}
          </button>
        )}

        <Popover
          label={t('toolbar.sort')}
          buttonClassName="pill border-line! text-ink"
          button={
            <>
              <ArrowDownUp size={14} strokeWidth={1.7} aria-hidden />
              <span className="hidden sm:inline">{t(`sort.${sort.key}`)}</span>
            </>
          }
          panelClassName="w-[220px] p-1.5"
        >
          {(close) => (
            <ul>
              {SORT_KEYS.filter((k) => k !== 'expiry' || adapter.capabilities.billing).map((key) => {
                const active = sort.key === key
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className="flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[14px] hover:bg-wash"
                      onClick={() => {
                        setSort(active ? { key, desc: !sort.desc } : { key, desc: DEFAULT_DESC[key] })
                        close()
                      }}
                    >
                      <span className="flex-1">{t(`sort.${key}`)}</span>
                      {active && (
                        <span className="flex items-center gap-1 text-[12px] text-muted">
                          {sort.desc ? t('toolbar.descending') : t('toolbar.ascending')}
                          <Check size={15} strokeWidth={1.8} className="text-ink" aria-hidden />
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Popover>

        <div className="segmented flex rounded-full border border-line p-0.5" role="group" aria-label={t('toolbar.view')}>
          {(
            [
              ['ledger', List, 'list'],
              ['cards', LayoutGrid, 'grid'],
            ] as const
          ).map(([value, Icon, labelKey]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              title={t(`toolbar.${labelKey}`)}
              aria-label={t(`toolbar.${labelKey}`)}
              onClick={() => setView(value as View)}
              className={`grid h-8 w-9 place-items-center rounded-full transition-colors ${
                view === value ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon size={15} strokeWidth={1.7} />
            </button>
          ))}
        </div>

        {/* Density is a row height, so it has nothing to say about cards. */}
        {view === 'ledger' && (
          /* A phone's first toolbar row has room for groups, sort and view only; density is a desktop
             refinement, and with it the row wrapped to a third line on touch screens. */
          <div className="segmented hidden rounded-full border border-line p-0.5 md:flex" role="group" aria-label={t('toolbar.density')}>
            {(
              [
                ['comfortable', Rows2],
                ['compact', Rows3],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={density === value}
                title={t(`toolbar.${value}`)}
                aria-label={t(`toolbar.${value}`)}
                onClick={() => setDensity(value as Density)}
                className={`grid h-8 w-9 place-items-center rounded-full transition-colors ${
                  density === value ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon size={15} strokeWidth={1.7} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* the ledger */}
      {/* While the connection is down after data arrived, the readings stay but dim: they are the
          last known values, not a fleet that went offline. */}
      <section className="mt-4" data-stale={fed && connection !== 'open' ? '' : undefined}>
        {shown === 0 ? (
          <p className="rounded-[20px] border border-dashed border-line py-16 text-center text-[14px] text-muted">{t('toolbar.empty')}</p>
        ) : (
          sections.map((section) => (
            <div key={section.name || 'ungrouped'}>
              {section.titled && (
                <GroupHeading
                  id={anchorId(section.name)}
                  name={section.name || t('toolbar.ungrouped')}
                  count={section.rows.length}
                  up={section.up}
                  down={section.down}
                />
              )}
              {view === 'cards' ? (
                <div data-grid="cards" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.rows.map((node) => (
                    <NodeCard key={node.id} node={node} snap={snapshots[node.id]} tick={tick} pending={!fed && !snapshots[node.id]} />
                  ))}
                </div>
              ) : (
                section.rows.map((node) => (
                  <NodeStrip key={node.id} node={node} snap={snapshots[node.id]} tick={tick} density={density} pending={!fed && !snapshots[node.id]} />
                ))
              )}
            </div>
          ))
        )}
        {shown > 0 && (
          <p className="num mt-4 text-[12px] text-muted">
            {filtering ? t('status.shown', { shown, count: nodes.length }) : t('status.summary', { online, count: nodes.length })}
          </p>
        )}
      </section>
    </div>
  )
}
