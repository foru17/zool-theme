export type Appearance = 'system' | 'light' | 'dark'
/**
 * The two shapes the home page can take. They show the same readings through the same
 * instruments; the ledger puts them in columns for comparing many nodes at a glance, the
 * cards give each node its own block for reading one node at a time.
 */
export type View = 'ledger' | 'cards'
export type Grouping = 'flat' | 'grouped'
/** Ledger row height. Only the ledger has rows, so this does nothing in the card view. */
export type Density = 'comfortable' | 'compact'
export type LanguagePreference = 'auto' | 'en' | 'zh-CN' | 'zh-TW' | 'ja'

/**
 * Theme settings. On Komari these are edited in the admin panel (managed configuration
 * declared in komari-theme.json) and read from /api/public; on Nezha they come from
 * `window.ZoolConfig` in config.js. Keys must stay in sync with komari-theme.json.
 */
export interface ThemeSettings {
  defaultAppearance: Appearance
  defaultView: View
  defaultDensity: Density
  defaultLanguage: LanguagePreference
  siteTitle: string
  showOverview: boolean
  showCost: boolean
  showRegions: boolean
  /** Offer the group filter on the home page (false hides the control and never sections by group) */
  showGroups: boolean
  /** When the visitor has picked no groups, section the home page by group instead of one flat list. */
  defaultGrouped: boolean
  showBilling: boolean
  showOffline: boolean
  hiddenNodes: string[]
  hideAdminEntry: boolean
  footerNote: string
}

export const DEFAULT_SETTINGS: ThemeSettings = {
  defaultAppearance: 'system',
  defaultView: 'ledger',
  defaultDensity: 'comfortable',
  defaultLanguage: 'auto',
  siteTitle: '',
  showOverview: true,
  showCost: true,
  showRegions: true,
  showGroups: true,
  defaultGrouped: false,
  showBilling: true,
  showOffline: true,
  hiddenNodes: [],
  hideAdminEntry: false,
  footerNote: '',
}

const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback

const bool = (v: unknown, fallback: boolean) => {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean)
  if (typeof v === 'string')
    return v
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
  return []
}

/** Accepts anything the backend hands over and returns a complete, typed settings object. */
export function normalizeSettings(raw: unknown): ThemeSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_SETTINGS
  return {
    defaultAppearance: oneOf(r.defaultAppearance, ['system', 'light', 'dark'], d.defaultAppearance),
    // v0.1 wrote `grid`/`list` into this same key. `list` now means what it says again, so it
    // maps to the ledger rather than being read as a density the way v0.2 briefly read it.
    defaultView: oneOf(r.defaultView, ['ledger', 'cards'], r.defaultView === 'grid' ? 'cards' : d.defaultView),
    defaultDensity: oneOf(r.defaultDensity, ['comfortable', 'compact'], d.defaultDensity),
    defaultLanguage: oneOf(r.defaultLanguage, ['auto', 'en', 'zh-CN', 'zh-TW', 'ja'], d.defaultLanguage),
    siteTitle: str(r.siteTitle, d.siteTitle).trim(),
    showOverview: bool(r.showOverview, d.showOverview),
    showCost: bool(r.showCost, d.showCost),
    showRegions: bool(r.showRegions, d.showRegions),
    showGroups: bool(r.showGroups, d.showGroups),
    defaultGrouped: bool(r.defaultGrouped, d.defaultGrouped),
    showBilling: bool(r.showBilling, d.showBilling),
    showOffline: bool(r.showOffline, d.showOffline),
    hiddenNodes: list(r.hiddenNodes),
    hideAdminEntry: bool(r.hideAdminEntry, d.hideAdminEntry),
    footerNote: str(r.footerNote, d.footerNote).trim(),
  }
}
