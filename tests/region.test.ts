import { describe, expect, it } from 'vitest'
import { FLAG_CODES } from '../src/core/flags.manifest'
import { flagToRegion, regionFlagCode, regionName } from '../src/core/region'

describe('regionName', () => {
  it.each([
    ['zh-CN', '中国台湾'],
    ['zh-TW', '中國台灣'],
    ['en', 'Taiwan, China'],
    ['ja', '中国台湾'],
    ['fr', 'Taiwan, China'],
  ])('uses the override display name for locale %s', (locale, expected) => {
    expect(regionName('TW', locale)).toBe(expected)
    expect(regionName('tw', locale)).toBe(expected)
  })

  it('uses Intl.DisplayNames for codes without overrides', () => {
    expect(regionName('JP', 'en')).toBe('Japan')
    expect(regionName('JP', 'ja')).toBe(new Intl.DisplayNames(['ja'], { type: 'region' }).of('JP'))
    expect(regionName('US', 'zh-CN')).toBe(new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of('US'))
  })

  it('returns an empty name for an unknown empty region', () => {
    expect(regionName('', 'en')).toBe('')
  })
})

describe('regionFlagCode', () => {
  it('normalizes an available region to its lowercase flag code', () => {
    expect(regionFlagCode('US', FLAG_CODES)).toBe('us')
  })

  it.each(['tw', 'TW'])('maps overridden code %s to its shared flag file', (code) => {
    expect(regionFlagCode(code, FLAG_CODES)).toBe('cn')
  })

  it.each(['usa', 'U1', '', '🇺🇸', '../', 'éa', 'ＵＳ', ' US'])('rejects invalid flag input %j', (code) => {
    expect(regionFlagCode(code, FLAG_CODES)).toBeNull()
  })

  it('rejects a two-letter region absent from the shipped manifest', () => {
    expect(FLAG_CODES.has('xx')).toBe(false)
    expect(regionFlagCode('XX', FLAG_CODES)).toBeNull()
  })
})

describe('flagToRegion', () => {
  it('extracts HK from a leading Hong Kong flag', () => {
    expect(flagToRegion('🇭🇰 HK')).toBe('HK')
  })

  it('accepts whitespace before a leading flag', () => {
    expect(flagToRegion('  🇭🇰 HK')).toBe('HK')
  })

  it.each(['', 'HK', 'HK 🇭🇰', '🏠 Home'])('returns an empty code when %j does not start with a flag', (text) => {
    expect(flagToRegion(text)).toBe('')
  })
})
