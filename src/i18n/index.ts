import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import ja from './locales/ja.json'

export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
] as const

export type Locale = (typeof LOCALES)[number]['code']

const STORAGE_KEY = 'language'

export function matchLocale(input: string | null | undefined): Locale | null {
  if (!input) return null
  const v = input.replace('_', '-').toLowerCase()
  if (v.startsWith('zh')) return /tw|hk|mo|hant/.test(v) ? 'zh-TW' : 'zh-CN'
  if (v.startsWith('ja')) return 'ja'
  if (v.startsWith('en')) return 'en'
  return null
}

export function storedLocale(): Locale | null {
  try {
    return matchLocale(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

/** Visitor choice → site default → browser → English. */
export function resolveLocale(siteDefault?: string | null): Locale {
  return (
    storedLocale() ??
    matchLocale(siteDefault && siteDefault !== 'auto' ? siteDefault : null) ??
    navigator.languages.map(matchLocale).find(Boolean) ??
    'en'
  )
}

export function setLocale(locale: Locale, persist = true) {
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      /* private mode */
    }
  }
  document.documentElement.lang = locale
  return i18n.changeLanguage(locale)
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
    'zh-TW': { translation: zhTW },
    ja: { translation: ja },
  },
  lng: storedLocale() ?? navigator.languages.map(matchLocale).find(Boolean) ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

document.documentElement.lang = i18n.language

export default i18n
