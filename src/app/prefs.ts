import { useEffect, useSyncExternalStore } from 'react'
import type { Appearance, Density, Grouping, View } from '@/core/settings'

/**
 * Visitor preferences, stored in localStorage. `appearance` and `language` use the
 * key names shared by Komari themes so a visitor's choice survives a theme switch.
 */

const KEYS = { appearance: 'appearance', density: 'zool:density', view: 'zool:view', grouping: 'zool:grouped' } as const

const read = (key: string) => {
  try {
    const v = localStorage.getItem(key)
    return v && v.charAt(0) === '"' ? (JSON.parse(v) as string) : v
  } catch {
    return null
  }
}

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/* ---------- appearance ---------- */

const media = window.matchMedia('(prefers-color-scheme: dark)')
let defaultAppearance: Appearance = 'system'

const storedAppearance = (): Appearance | null => {
  const v = read(KEYS.appearance)
  return v === 'light' || v === 'dark' || v === 'system' ? v : null
}

export const getAppearance = (): Appearance => storedAppearance() ?? defaultAppearance

export function applyAppearance() {
  const mode = getAppearance()
  const dark = mode === 'dark' || (mode === 'system' && media.matches)
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function setAppearance(mode: Appearance) {
  write(KEYS.appearance, mode)
  applyAppearance()
  emit()
}

export function setDefaultAppearance(mode: Appearance) {
  defaultAppearance = mode
  applyAppearance()
  emit()
}

media.addEventListener('change', () => {
  applyAppearance()
  emit()
})

export const useAppearance = () => useSyncExternalStore(subscribe, getAppearance, getAppearance)

/** The resolved scheme, for things like chart colours. */
export const useScheme = () =>
  useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
    () => 'light' as const,
  )

/* ---------- ledger density ---------- */

let defaultDensity: Density = 'comfortable'
const getDensity = (): Density => {
  const v = read(KEYS.density)
  return v === 'comfortable' || v === 'compact' ? v : defaultDensity
}

export function setDensity(density: Density) {
  write(KEYS.density, density)
  emit()
}

export function useDensity(fallback: Density) {
  useEffect(() => {
    if (defaultDensity !== fallback) {
      defaultDensity = fallback
      emit()
    }
  }, [fallback])
  return useSyncExternalStore(subscribe, getDensity, getDensity)
}

/* ---------- home view ---------- */

let defaultView: View = 'ledger'
const getView = (): View => {
  const v = read(KEYS.view)
  return v === 'ledger' || v === 'cards' ? v : defaultView
}

export function setView(view: View) {
  write(KEYS.view, view)
  emit()
}

export function useView(fallback: View) {
  useEffect(() => {
    if (defaultView !== fallback) {
      defaultView = fallback
      emit()
    }
  }, [fallback])
  return useSyncExternalStore(subscribe, getView, getView)
}

/* ---------- home grouping ---------- */

let defaultGrouping: Grouping = 'flat'
const getGrouping = (): Grouping => {
  const v = read(KEYS.grouping)
  return v === 'flat' || v === 'grouped' ? v : defaultGrouping
}

export function setGrouping(grouping: Grouping) {
  write(KEYS.grouping, grouping)
  emit()
}

export function useGrouping(fallback: Grouping) {
  useEffect(() => {
    if (defaultGrouping !== fallback) {
      defaultGrouping = fallback
      emit()
    }
  }, [fallback])
  return useSyncExternalStore(subscribe, getGrouping, getGrouping)
}
