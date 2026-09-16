import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { daysUntil, formatBytes, formatNumber, monthlyCost, splitSpeed, trafficUsed } from '../src/core/format'
import { flagToRegion, stripFlag } from '../src/core/region'
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/core/settings'
import { summariseDay } from '../src/core/summary'

describe('format', () => {
  it('formats bytes with sensible precision', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(125 * 1024 ** 4)).toBe('125 TB')
    expect(splitSpeed(3.11 * 1024 ** 2)).toEqual({ value: '3.11', unit: 'MB/s' })
  })

  it('trims only decimal zeros', () => {
    expect(formatNumber(100, 0)).toBe('100')
    expect(formatNumber(50, 1)).toBe('50')
    expect(formatNumber(0.5)).toBe('0.5')
    expect(formatNumber(2.0)).toBe('2')
  })

  it('follows the traffic limit type', () => {
    expect(trafficUsed('sum', 3, 4)).toBe(7)
    expect(trafficUsed('max', 3, 4)).toBe(4)
    expect(trafficUsed('min', 3, 4)).toBe(3)
    expect(trafficUsed('up', 3, 4)).toBe(3)
    expect(trafficUsed('down', 3, 4)).toBe(4)
  })

  it('normalises prices to a month', () => {
    expect(monthlyCost(120, 365)).toBeCloseTo(9.86, 2)
    expect(monthlyCost(-1, 30)).toBe(0)
    expect(monthlyCost(10, 0)).toBe(0)
    expect(daysUntil(Date.now() + 86_400_000 * 2.5)).toBe(3)
  })
})

describe('day summary', () => {
  const p = (at: number, netUp: number, netDown: number, totalUp?: number, totalDown?: number) => ({
    at, cpu: 0, memUsed: 0, swapUsed: 0, diskUsed: 0, netUp, netDown, load1: 0, tcp: 0, udp: 0, process: 0, totalUp, totalDown,
  })

  it('uses counter growth since midnight and the highest recorded rates', () => {
    const midnight = 1_000
    const s = summariseDay([p(500, 9, 1, 100, 200), p(1_000, 3, 7, 150, 260), p(2_000, 5, 2, 400, 300)], { totalUp: 450, totalDown: 360 }, midnight)
    expect(s).toMatchObject({ todayUp: 300, todayDown: 100, peakUp: 9, peakUpAt: 500, peakDown: 7, peakDownAt: 1_000 })
  })

  it('never reports negative traffic after a counter reset', () => {
    const s = summariseDay([p(2_000, 1, 1, 900, 900)], { totalUp: 10, totalDown: 10 }, 1_000)
    expect(s.todayUp).toBe(0)
    expect(s.todayDown).toBe(0)
  })
})

describe('region', () => {
  it('reads flag emoji', () => {
    expect(flagToRegion('🇺🇸 SJC')).toBe('US')
    expect(flagToRegion('🏠 Home')).toBe('')
    expect(stripFlag('🇭🇰 HK Bage')).toBe('HK Bage')
    expect(stripFlag('🏠 ChinaNet')).toBe('🏠 ChinaNet')
  })
})

describe('settings', () => {
  it('defaults to a flat home page when defaultGrouped is omitted', () => {
    expect(DEFAULT_SETTINGS.defaultGrouped).toBe(false)
    expect(normalizeSettings(undefined).defaultGrouped).toBe(false)
    expect(normalizeSettings({}).defaultGrouped).toBe(false)
  })

  it.each([
    [true, true],
    [false, false],
    ['true', true],
    ['false', false],
    ['invalid', false],
  ])('normalises defaultGrouped %j to %j', (value, expected) => {
    expect(normalizeSettings({ defaultGrouped: value }).defaultGrouped).toBe(expected)
  })

  it('fills every key when the backend sends nothing', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ defaultDensity: 'nope', showCost: 'false', hiddenNodes: 'a, b' })).toMatchObject({
      defaultDensity: 'comfortable',
      showCost: false,
      hiddenNodes: ['a', 'b'],
    })
  })

  it('reads a saved pre-0.2 view setting as the view it named', () => {
    expect(normalizeSettings({ defaultView: 'grid' }).defaultView).toBe('cards')
    // v0.2 briefly read `list` as a row height; the key means a view again, so it maps to one.
    expect(normalizeSettings({ defaultView: 'list' }).defaultView).toBe('ledger')
    expect(normalizeSettings({ defaultView: 'list' }).defaultDensity).toBe('comfortable')
    expect(normalizeSettings({ defaultView: 'cards' }).defaultView).toBe('cards')
  })

  it('declares every setting in komari-theme.json with a matching default', () => {
    const manifest = JSON.parse(readFileSync(new URL('../targets/komari/komari-theme.json', import.meta.url), 'utf8'))
    const declared = (manifest.configuration.data as { key?: string; type: string; default?: unknown }[]).filter(
      (d) => d.type !== 'title',
    )
    const keys = declared.map((d) => d.key)
    expect(new Set(keys)).toEqual(new Set(Object.keys(DEFAULT_SETTINGS)))
    for (const d of declared) {
      const expected = DEFAULT_SETTINGS[d.key as keyof typeof DEFAULT_SETTINGS]
      if (d.type === 'nodes') expect(expected).toEqual([])
      else expect(d.default).toEqual(expected)
    }
  })
})
