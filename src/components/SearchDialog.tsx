import { useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CornerDownLeft, Search } from 'lucide-react'
import { adapter, useStore, useVisibleNodes } from '@/app/store'
import { closeDialog, useDialog } from '@/app/ui'
import { navigate } from '@/app/router'
import { regionName, stripFlag } from '@/core/region'
import { formatPercent } from '@/core/format'
import { Dialog } from './Dialog'
import { RegionTag, StatusDot } from './bits'

function SearchPanel() {
  const { t, i18n } = useTranslation()
  const nodes = useVisibleNodes()
  const snapshots = useStore((s) => s.snapshots)
  const fed = useStore((s) => s.fed)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const haystack = (n: (typeof nodes)[number]) =>
      [n.name, n.region, regionName(n.region, i18n.language), ...n.groups, ...n.tags, n.os].join(' ').toLowerCase()
    return nodes.filter((n) => terms.every((term) => haystack(n).includes(term))).slice(0, 50)
  }, [nodes, query, i18n.language])

  const open = (id: string) => {
    closeDialog('search')
    navigate(adapter.nodePath(id))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length)
      setActive(next)
      document.getElementById(`search-option-${next}`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      open(results[active].id)
    }
  }

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex h-14 items-center gap-3 border-b border-line px-5">
        <Search size={18} strokeWidth={1.6} className="text-muted" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          placeholder={t('toolbar.searchPlaceholder')}
          aria-label={t('toolbar.search')}
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `search-option-${active}` : undefined}
          className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
        />
        <kbd className="rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">Esc</kbd>
      </div>
      <ul id="search-results" role="listbox" className="max-h-[min(420px,60dvh)] overflow-y-auto p-2">
        {results.map((n, i) => {
          const s = snapshots[n.id]
          return (
            <li key={n.id} id={`search-option-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseMove={() => setActive(i)}
                onClick={() => open(n.id)}
                className={`flex h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left ${i === active ? 'bg-wash' : ''}`}
              >
                <StatusDot online={Boolean(s?.online)} pending={!fed && !s} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{stripFlag(n.name)}</span>
                <span className="hidden truncate text-[12px] text-muted sm:block">{n.groups[0]}</span>
                <RegionTag code={n.region} />
                <span className="num w-12 text-right text-[12px] text-muted">{s?.online ? `${formatPercent(s.cpu)}%` : '—'}</span>
              </button>
            </li>
          )
        })}
        {results.length === 0 && <li className="px-3 py-10 text-center text-[14px] text-muted">{t('toolbar.noResults')}</li>}
      </ul>
      <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 text-[12px] text-muted">
        <CornerDownLeft size={13} aria-hidden />
        {t('toolbar.searchHint')}
      </div>
    </div>
  )
}

export function SearchDialog() {
  const open = useDialog('search')
  return (
    <Dialog open={open} onClose={() => closeDialog('search')} className="mx-auto mt-[12dvh] mb-auto w-[min(600px,calc(100%-32px))] overflow-hidden">
      <SearchPanel />
    </Dialog>
  )
}
