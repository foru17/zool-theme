import { Trans, useTranslation } from 'react-i18next'
import { adapter, useStore } from '@/app/store'
import { Wordmark } from './Brand'

function GitHubMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-[13px] w-[13px] shrink-0 ${className}`} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

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
              components={{
                link: <a className="text-ink underline-offset-4 hover:underline" href={adapter.poweredBy.url} target="_blank" rel="noreferrer">{adapter.poweredBy.name}</a>,
              }}
            />
            <span className="mx-2 text-faint">·</span>
            <a
              className="underline-offset-4 hover:text-ink hover:underline"
              href="https://github.com/foru17/zool-theme"
              target="_blank"
              rel="noreferrer"
            >
              <GitHubMark className="mr-1.5 inline-block align-[-2px]" />
              {t('app.theme', { version: `v${__ZOOL_VERSION__}` })}
            </a>
          </p>
        </div>
        <p className="text-[12px] text-muted">
          <Trans
            i18nKey="app.productBy"
            components={{
              link: <a className="text-ink underline-offset-4 hover:underline" href="https://x.com/luoleiorg" target="_blank" rel="noreferrer">@luoleiorg</a>,
            }}
          />
        </p>
      </div>
      {/* The closing wordmark from the ZOOL site, cropped so it rises from the page edge. */}
      <div className="wrap h-[clamp(40px,9vw,112px)] overflow-hidden" aria-hidden="true">
        <Wordmark className="h-auto w-full translate-y-[12%] text-wash" />
      </div>
    </footer>
  )
}
