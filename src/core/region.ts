const FLAG = /^\s*([\u{1F1E6}-\u{1F1FF}]{2})\s*/u
const A = 0x1f1e6

/** "🇺🇸" → "US". Returns "" when the string does not start with a flag. */
export function flagToRegion(text: string): string {
  const m = FLAG.exec(text)
  if (!m) return ''
  return [...m[1]].map((c) => String.fromCharCode((c.codePointAt(0) ?? A) - A + 65)).join('')
}

/** Drops a leading flag emoji; node names often start with one. */
export const stripFlag = (text: string) => text.replace(FLAG, '').trim() || text

const displayNames = new Map<string, Intl.DisplayNames | null>()

export function regionName(code: string, locale: string) {
  if (!code) return ''
  if (code.toUpperCase() === 'TW') return REGION_NAME_OVERRIDES[locale] ?? REGION_NAME_OVERRIDES[locale.split('-')[0]] ?? REGION_NAME_OVERRIDES.en
  let dn = displayNames.get(locale)
  if (dn === undefined) {
    try {
      dn = new Intl.DisplayNames([locale], { type: 'region' })
    } catch {
      dn = null
    }
    displayNames.set(locale, dn)
  }
  try {
    return dn?.of(code) ?? code
  } catch {
    return code
  }
}

/** Display names that override Intl.DisplayNames for some region codes. */
const REGION_NAME_OVERRIDES: Record<string, string> = {
  'zh-CN': '中国台湾',
  'zh-TW': '中國台灣',
  ja: '中国台湾',
  en: 'Taiwan, China',
}

/**
 * The flag file for a region code, or `null` for anything that is not a two-letter code we
 * ship. Only ASCII letters are accepted, so no input can turn into an arbitrary path.
 */
export function regionFlagCode(code: string, available: ReadonlySet<string>): string | null {
  if (!/^[A-Za-z]{2}$/.test(code)) return null
  const cc = code.toLowerCase() === 'tw' ? 'cn' : code.toLowerCase()
  return available.has(cc) ? cc : null
}
