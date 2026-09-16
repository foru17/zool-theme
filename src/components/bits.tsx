import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import type { NodeInfo } from '@/core/model'
import { FLAG_CODES } from '@/core/flags.manifest'
import { regionFlagCode } from '@/core/region'
import { daysUntil, duration, formatMoney, formatPercent, splitBytes, splitSpeed, type Parts } from '@/core/format'

export function StatusDot({ online, pending, className = '' }: { online: boolean; pending?: boolean; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={`status-dot ${className}`}
      data-online={pending ? undefined : online}
      data-pending={pending ? '' : undefined}
      role="img"
      aria-label={t(pending ? 'status.connecting' : online ? 'status.online' : 'status.offline')}
    />
  )
}

/** A number with a smaller unit, e.g. 3.11 MB/s. */
export function Quantity({ parts, className = '', unitClassName = '' }: { parts: Parts; className?: string; unitClassName?: string }) {
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      {parts.value}
      <span className={`ml-[0.2em] text-[0.72em] text-muted ${unitClassName}`}>{parts.unit}</span>
    </span>
  )
}

export const Bytes = ({ value, className, digits }: { value: number; className?: string; digits?: number }) => (
  <Quantity parts={splitBytes(value, digits)} className={className} />
)

export const Speed = ({ value, className }: { value: number; className?: string }) => (
  <Quantity parts={splitSpeed(value)} className={className} />
)

export const Percent = ({ value, className }: { value: number; className?: string }) => (
  <Quantity parts={{ value: formatPercent(value), unit: '%' }} className={className} />
)

export function useUptime() {
  const { t } = useTranslation()
  return (seconds: number) => {
    const d = duration(seconds)
    if (d.days > 0) return t('unit.days', { count: d.days })
    if (d.hours > 0) return `${d.hours}${t('unit.hourShort')} ${d.minutes}${t('unit.minuteShort')}`
    return `${d.minutes}${t('unit.minuteShort')}`
  }
}

export function useBilling() {
  const { t } = useTranslation()
  const cycle = (days: number) => {
    if (days <= 0) return days === -1 ? ` ${t('unit.oneTime')}` : ''
    if (days >= 28 && days <= 31) return t('unit.perMonth')
    if (days >= 360 && days <= 366) return t('unit.perYear')
    return t('unit.perDays', { count: days })
  }
  return {
    price(n: NodeInfo) {
      if (n.price === -1) return t('metric.free')
      if (!(n.price > 0)) return ''
      return `${formatMoney(n.price, n.currency)}${cycle(n.billingCycle)}`
    },
    expiry(n: NodeInfo): { text: string; level?: 'warn' | 'danger' } | null {
      if (n.expiredAt === null) return null
      const days = daysUntil(n.expiredAt)
      if (days > 3650) return { text: t('expiry.longTerm') }
      if (days < 0) return { text: t('expiry.expired'), level: 'danger' }
      if (days === 0) return { text: t('expiry.today'), level: 'danger' }
      return { text: t('expiry.inDays', { count: days }), level: days <= 7 ? 'danger' : days <= 30 ? 'warn' : undefined }
    },
  }
}

export function useRelativeTime() {
  const { i18n } = useTranslation()
  return (at: number) => {
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })
    const s = Math.round((at - Date.now()) / 1000)
    const abs = Math.abs(s)
    if (abs < 60) return rtf.format(s, 'second')
    if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour')
    return rtf.format(Math.round(s / 86400), 'day')
  }
}

/**
 * A region's flag, served from this site (`public/flags`, flag-icons 4:3). Decoration only:
 * the code or name always sits beside it, so it is hidden from assistive technology. An
 * unknown or malformed code gets a neutral globe rather than a guessed file name.
 */
export function RegionFlag({ code, className = '' }: { code: string; className?: string }) {
  const cc = regionFlagCode(code, FLAG_CODES)
  if (!cc) return <Globe size={12} strokeWidth={1.7} className={`shrink-0 text-faint ${className}`} aria-hidden />
  return <img className={`flag ${className}`} src={`/flags/${cc}.svg`} alt="" aria-hidden="true" width={16} height={12} loading="lazy" decoding="async" />
}

/** Two-letter region code with its flag, in a quiet mono tag. */
export function RegionTag({ code, className = '' }: { code: string; className?: string }) {
  if (!code) return null
  return (
    <span
      className={`inline-flex h-[20px] items-center gap-1 rounded-[6px] border border-line px-1.5 font-mono text-[11px] leading-none tracking-wide text-muted ${className}`}
    >
      <RegionFlag code={code} />
      {code}
    </span>
  )
}
