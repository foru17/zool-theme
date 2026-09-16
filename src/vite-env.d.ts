/// <reference types="vite/client" />

declare const __ZOOL_TARGET__: 'komari' | 'nezha' | 'demo'
declare const __ZOOL_VERSION__: string

interface Window {
  /** Nezha runtime configuration, see targets/nezha/config.js. */
  ZoolConfig?: Record<string, unknown>
}
