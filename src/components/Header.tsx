import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Check, Monitor, Moon, RefreshCw, Search, Sun } from 'lucide-react'
import { adapter, refresh, useStore } from '@/app/store'
import { Link } from '@/app/router'
import { openDialog } from '@/app/ui'
import { setAppearance, useAppearance } from '@/app/prefs'
import { LOCALES, setLocale, type Locale } from '@/i18n'
import type { Appearance } from '@/core/settings'
import { Popover } from './Popover'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null
  return !!node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName))
}

const APPEARANCE_ICON = { light: Sun, dark: Moon, system: Monitor } as const

function PrefsMenu() {
  const { t, i18n } = useTranslation()
  const appearance = useAppearance()
  const Icon = APPEARANCE_ICON[appearance]
  const options: Appearance[] = ['light', 'dark', 'system']

  return (
    <Popover label={`${t('prefs.appearance')} · ${t('prefs.language')}`} button={<Icon size={18} strokeWidth={1.6} />} panelClassName="w-[248px] p-2">
      {(close) => (
        <div>
          <p className="eyebrow px-3 pt-2 pb-2">{t('prefs.appearance')}</p>
          <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-wash p-1">
            {options.map((mode) => {
              const I = APPEARANCE_ICON[mode]
              const active = appearance === mode
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAppearance(mode)}
                  className={`flex flex-col items-center gap-1 rounded-[9px] py-2 text-[12px] transition-colors ${
                    active ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]' : 'text-muted hover:text-ink'
                  }`}
                >
                  <I size={16} strokeWidth={1.6} />
                  {t(`prefs.${mode}`)}
                </button>
              )
            })}
          </div>
          <div className="my-2 h-px bg-line" />
          <p className="eyebrow px-3 pt-1 pb-1">{t('prefs.language')}</p>
          <ul>
            {LOCALES.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  lang={l.code}
                  onClick={() => {
                    setLocale(l.code as Locale)
                    close()
                  }}
                  className="flex h-10 w-full items-center justify-between rounded-[10px] px-3 text-[14px] hover:bg-wash"
                >
                  {l.label}
                  {i18n.language === l.code && <Check size={16} strokeWidth={1.8} aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  )
}

export function Header() {
  const { t } = useTranslation()
  const site = useStore((s) => s.site)
  const settings = useStore((s) => s.settings)
  const session = useStore((s) => s.session)
  const refreshing = useStore((s) => s.refreshing)
  const ready = useStore((s) => s.phase === 'ready')
  const title = settings.siteTitle || site?.name || ''

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isTyping(e.target))) {
        e.preventDefault()
        openDialog('search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="wrap flex h-16 items-center gap-2">
        <Link href="/" className="mr-auto min-w-0 truncate rounded-md text-[19px] font-[450] tracking-[-0.02em]">
          {title}
        </Link>

        <button
          type="button"
          onClick={() => openDialog('search')}
          className="hidden h-9 w-60 items-center gap-2 rounded-full border border-line pr-2 pl-3.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink md:inline-flex"
        >
          <Search size={15} strokeWidth={1.7} aria-hidden />
          <span>{t('toolbar.search')}</span>
          <kbd className="ml-auto rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[11px] leading-none">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        <button type="button" className="icon-btn md:hidden" aria-label={t('toolbar.search')} onClick={() => openDialog('search')}>
          <Search size={18} strokeWidth={1.6} />
        </button>

        {/* Reloads the node list and reopens the live connection in place: the page, its scroll
            position and its filters stay, which a browser reload would throw away. */}
        {ready && (
          <button
            type="button"
            className="icon-btn"
            aria-label={t('node.refresh')}
            title={t('node.refresh')}
            aria-busy={refreshing}
            /* aria-disabled rather than disabled: a disabled button drops keyboard focus; refresh()
               already ignores presses while one is running */
            aria-disabled={refreshing}
            onClick={refresh}
          >
            <RefreshCw size={17} strokeWidth={1.6} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}

        <PrefsMenu />

        {session.loggedIn ? (
          <a href={adapter.adminUrl} className="btn-outline ml-1">
            {t('auth.dashboard')}
            <ArrowUpRight size={15} strokeWidth={1.7} aria-hidden />
          </a>
        ) : (
          !settings.hideAdminEntry && (
            <button type="button" className="btn-outline ml-1" onClick={() => openDialog('login')}>
              {t('auth.signIn')}
            </button>
          )
        )}
      </div>
    </header>
  )
}
