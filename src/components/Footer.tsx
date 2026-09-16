import { Trans, useTranslation } from 'react-i18next'
import { adapter, useStore } from '@/app/store'
import { Wordmark } from './Brand'

export function Footer() {
  const { t } = useTranslation()
  const note = useStore((s) => s.settings.footerNote)

  return (
    <footer className="mt-24 border-t border-line">
      <div className="wrap flex flex-col gap-6 pt-10 pb-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 text-[13px] leading-relaxed text-muted">
          {note && <p className="text-ink">{note}</p>}
          <p>
            <Trans
              i18nKey="app.poweredBy"
              values={{ name: adapter.poweredBy.name }}
              components={{
                link: <a className="text-ink underline-offset-4 hover:underline" href={adapter.poweredBy.url} target="_blank" rel="noreferrer" />,
              }}
            />
            <span className="mx-2 text-faint">·</span>
            <a
              className="underline-offset-4 hover:text-ink hover:underline"
              href="https://github.com/foru17/zool-theme"
              target="_blank"
              rel="noreferrer"
            >
              {t('app.theme', { version: `v${__ZOOL_VERSION__}` })}
            </a>
          </p>
        </div>
        <a
          href="https://zool.app"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 text-[12px] text-muted transition-colors hover:text-ink"
        >
          {t('app.productBy')}
          <Wordmark className="h-[11px] w-auto" />
        </a>
      </div>
      {/* The closing wordmark from the ZOOL site, cropped so it rises from the page edge. */}
      <div className="wrap h-[clamp(40px,9vw,112px)] overflow-hidden" aria-hidden="true">
        <Wordmark className="h-auto w-full translate-y-[12%] text-wash" />
      </div>
    </footer>
  )
}
