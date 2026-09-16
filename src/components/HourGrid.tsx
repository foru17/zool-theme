import { useTranslation } from 'react-i18next'
import type { HistoryPoint } from '@/core/model'
import { bucketSeries } from '@/core/live'

const HOUR = 3_600_000

/**
 * Seven days, one cell per hour: filled when the node reported, hollow when it did not.
 *
 * Seven days is the longest range the backend keeps at hourly resolution — the 30-day range
 * is averaged to one point per day, which quietly swallows a real outage. Drawing 90 days
 * from it would be fiction, so this grid stops where the honest data stops.
 */
export function HourGrid({ points, days = 7, now = Date.now() }: { points: readonly HistoryPoint[]; days?: number; now?: number }) {
  const { t, i18n } = useTranslation()
  const cells = days * 24
  // Align to local midnight so a row is a calendar day and a cell is a wall-clock hour;
  // the last row runs to the current hour and the rest of it stays empty.
  const end = new Date(now)
  end.setMinutes(0, 0, 0)
  const lastHour = end.getTime()
  const startOfToday = new Date(lastHour)
  startOfToday.setHours(0, 0, 0, 0)
  const from = startOfToday.getTime() - (days - 1) * 24 * HOUR
  // The window ends at the hour we are in; the rest of today is not history yet.
  const buckets = bucketSeries(points, (p) => p.at, cells, from, from + cells * HOUR).map((b, i) =>
    from + i * HOUR > lastHour ? { ...b, value: null } : b,
  )
  // Only hours that have happened can be missing; counting the rest of today as unreported
  // would read as twelve hours of downtime every morning.
  const elapsed = Math.round((lastHour - from) / HOUR) + 1
  const seen = buckets.filter((b) => b.value !== null).length
  const first = points.length ? points[0].at : now

  const rows = Array.from({ length: days }, (_, d) => buckets.slice(d * 24, d * 24 + 24))
  const dayLabel = (index: number) =>
    new Date(from + index * 24 * HOUR).toLocaleDateString(i18n.language, { month: 'numeric', day: 'numeric' })

  return (
    <section aria-label={t('node.uptimeGrid')}>
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">{t('node.uptimeGrid')}</h2>
        <p className="num text-[12px] text-muted">{t('node.reportedHours', { count: seen, total: elapsed })}</p>
      </div>
      <div className="mt-3 space-y-[3px]">
        {rows.map((row, d) => (
          <div key={d} className="flex items-center gap-2">
            <span className="num w-10 shrink-0 text-right text-[10px] text-muted">{dayLabel(d)}</span>
            <span className="flex flex-1 gap-[2px]">
              {row.map((cell, h) => {
                const at = from + (d * 24 + h) * HOUR
                // Hours we never watched, and hours still ahead of the clock, are not outages.
                const state = at > lastHour || at < first - HOUR ? 'unwatched' : cell.value !== null ? 'up' : 'down'
                const hour = new Date(at)
                const stamp = `${hour.toLocaleDateString(i18n.language, { month: 'numeric', day: 'numeric' })} ${String(hour.getHours()).padStart(2, '0')}:00`
                return (
                  <span
                    key={h}
                    // Hours that have not happened carry no reading, so they carry no tooltip either.
                    title={at > lastHour ? undefined : stamp}
                    className={`h-[10px] flex-1 rounded-[1px] ${state === 'up' ? 'bg-sage-text' : state === 'down' ? 'bg-danger' : 'cell-empty'}`}
                  />
                )
              })}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
