import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { adapter, start, useStore } from './store'
import { usePathname } from './router'
import { setDefaultAppearance, useView } from './prefs'
import { resolveLocale, setLocale } from '@/i18n'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SearchDialog } from '@/components/SearchDialog'
import { LoginDialog } from '@/components/LoginDialog'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { HomePage } from '@/pages/HomePage'
import { NodePage } from '@/pages/NodePage'

const placeholder = (className: string) => <div className={`skeleton ${className}`} />

function Loading({ node }: { node: string | null }) {
  const cards = useView('ledger') === 'cards' || node
  return (
    <div className="wrap pt-10 md:pt-16" aria-busy="true">
      <div className="h-4.5">{placeholder('h-3 w-36')}</div>
      {node && placeholder('mt-10 h-[38px] w-44 md:h-[55px]')}
      <div className={`grid grid-cols-3 border-y border-line ${node ? 'mt-10' : 'mt-4 gap-x-4 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-line'}`}>
        {Array.from({ length: node ? 6 : 4 }, (_, i) => (
          <div key={i} className={`h-[66.5px] py-3 md:h-[104.5px] md:py-4 lg:h-[112.5px] lg:px-5 lg:py-5 lg:first:pl-0 ${!node && i === 3 ? 'col-span-3 h-[91px] lg:col-span-1' : ''}`}>
            {placeholder('h-3 w-16')}
            {placeholder('mt-3 h-5 w-20 md:h-6')}
            {placeholder(`mt-2 h-[11px] w-16 ${!node && i === 3 ? '' : 'hidden md:block'}`)}
          </div>
        ))}
      </div>
      {/* a phone's toolbar is two rows (controls, then regions), 86px; one 40px row from md */}
      {!node && <div className="mt-8 flex h-[86px] flex-wrap content-start gap-x-2 gap-y-1.5 md:h-10">
        {placeholder('mr-auto h-10 w-28 rounded-full')}
        {placeholder('h-10 w-19 rounded-full')}
        {placeholder('h-10 w-19 rounded-full')}
        {placeholder('h-10 w-full rounded-full md:hidden')}
      </div>}
      <div className={node ? 'mt-16 grid gap-4 md:grid-cols-2' : cards ? 'mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'mt-4'}>
        {Array.from({ length: node ? 2 : 8 }, (_, i) => (
          <div key={i} className={node ? 'card h-[240px] p-5' : cards ? 'card min-h-[410px] p-5 lg:min-h-[390px]' : 'h-[89px] border-b border-line px-1 py-2.5 md:flex md:h-[51px] md:items-center md:px-2 md:py-3'}>
            {placeholder('h-3.5 w-40')}
            <div className={cards ? 'mt-5 grid gap-3' : 'mt-3 grid grid-cols-2 gap-2 pl-[26px] md:mt-0 md:ml-auto md:grid-cols-4 md:pl-0'}>
              {[0, 1, 2, 3].map((j) => <div key={j} className={`skeleton ${cards ? 'h-8' : 'h-3 md:w-20'}`} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadError() {
  const { t } = useTranslation()
  return (
    <div className="wrap pt-24">
      <h1 className="text-[36px] leading-tight font-light tracking-[-0.03em]">{t('app.loadError')}</h1>
      <p className="mt-3 text-[15px] text-muted">{t('app.loadErrorHint')}</p>
      <button type="button" className="btn-primary mt-8" onClick={() => start()}>
        {t('app.retry')}
      </button>
    </div>
  )
}

export function App() {
  const { t } = useTranslation()
  const phase = useStore((s) => s.phase)
  const site = useStore((s) => s.site)
  const settings = useStore((s) => s.settings)
  const pathname = usePathname()
  const nodeId = adapter.matchNodePath(pathname)

  useEffect(() => {
    start()
  }, [])

  useEffect(() => {
    setDefaultAppearance(settings.defaultAppearance)
  }, [settings.defaultAppearance])

  useEffect(() => {
    if (!site) return
    const preferred = settings.defaultLanguage !== 'auto' ? settings.defaultLanguage : site.language
    setLocale(resolveLocale(preferred), false)
  }, [site, settings.defaultLanguage])

  useEffect(() => {
    if (!nodeId) document.title = settings.siteTitle || site?.name || document.title
  }, [nodeId, site, settings.siteTitle])

  return (
    <>
      <a
        href="#main"
        className="fixed top-2 left-4 z-50 -translate-y-20 rounded-full bg-ink px-4 py-2 text-[13px] text-paper focus:translate-y-0"
      >
        {t('app.skip')}
      </a>
      <Header />
      <main id="main" className="min-h-[60dvh]">
        <ErrorBoundary resetKey={pathname} fallback={<LoadError />}>
          {phase === 'loading' ? <Loading node={nodeId} /> : phase === 'error' ? <LoadError /> : nodeId ? <NodePage id={nodeId} /> : <HomePage />}
        </ErrorBoundary>
      </main>
      <Footer />
      <SearchDialog />
      <LoginDialog />
    </>
  )
}
