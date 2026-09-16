import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { adapter, useStore } from '@/app/store'
import { closeDialog, useDialog } from '@/app/ui'
import { Dialog } from './Dialog'
import { Symbol } from './Brand'

function LoginForm() {
  const { t } = useTranslation()
  const site = useStore((s) => s.site)
  const siteTitle = useStore((s) => s.settings.siteTitle) || site?.name || ''
  const titleId = useId()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [needCode, setNeedCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info' | 'ok'; text: string } | null>(null)
  const oauth = site ? adapter.oauthUrl(site) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage(null)
    const result = await adapter.login(username.trim(), password, needCode ? code.trim() : undefined)
    setBusy(false)
    if (result.ok) {
      setMessage({ kind: 'ok', text: t('auth.success') })
      window.setTimeout(() => window.location.assign(adapter.adminUrl), 500)
      return
    }
    if (result.reason === 'need2fa') {
      setNeedCode(true)
      setMessage({ kind: 'info', text: t('auth.need2fa') })
    } else {
      setMessage({ kind: 'error', text: result.message && adapter.target === 'demo' ? result.message : t(`auth.${result.reason}`) })
    }
  }

  return (
    <div className="relative p-7 sm:p-9" aria-labelledby={titleId}>
      <button type="button" className="icon-btn absolute top-4 right-4" aria-label={t('auth.close')} onClick={() => closeDialog('login')}>
        <X size={18} strokeWidth={1.6} />
      </button>
      <Symbol className="h-[18px] w-auto text-ink" />
      <h2 id={titleId} className="mt-6 text-[28px] leading-tight font-light tracking-[-0.02em]">
        {t('auth.title')}
      </h2>
      <p className="mt-2 text-[14px] text-muted">{t('auth.subtitle', { site: siteTitle })}</p>

      {site?.passwordLogin !== false && (
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-muted">{t('auth.username')}</span>
          <input className="field" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-muted">{t('auth.password')}</span>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {needCode && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-muted">{t('auth.code')}</span>
            <input
              className="field num tracking-[0.3em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`text-[13px] ${message.kind === 'error' ? 'text-danger' : message.kind === 'ok' ? 'text-sage-text' : 'text-muted'}`}
          >
            {message.text}
          </p>
        )}
        <button type="submit" className="btn-primary mt-2 w-full" disabled={busy}>
          {busy ? t('auth.submitting') : t('auth.submit')}
        </button>
      </form>
      )}

      {oauth && (
        <>
          {site?.passwordLogin !== false ? (
            <div className="my-5 flex items-center gap-3 text-[12px] text-muted">
              <span className="h-px flex-1 bg-line" />
              {t('auth.or')}
              <span className="h-px flex-1 bg-line" />
            </div>
          ) : (
            <div className="mt-7" />
          )}
          <a href={oauth} className="btn-outline min-h-12 w-full">
            {t('auth.oauth', { provider: site?.oauthProvider ? site.oauthProvider[0].toUpperCase() + site.oauthProvider.slice(1) : 'SSO' })}
          </a>
        </>
      )}
      {adapter.target === 'nezha' && <p className="mt-5 text-[12px] leading-relaxed text-muted">{t('auth.wafHint')}</p>}
    </div>
  )
}

export function LoginDialog() {
  const open = useDialog('login')
  return (
    <Dialog open={open} onClose={() => closeDialog('login')}>
      <LoginForm />
    </Dialog>
  )
}
