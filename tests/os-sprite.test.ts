import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OS_COLORS, OS_KEYS } from '../src/core/os.manifest'

const sprite = readFileSync(new URL('../public/os/sprite.svg', import.meta.url), 'utf8')
const symbols = [...sprite.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)]

describe('OS sprite', () => {
  it('contains exactly the 27 manifest keys in sorted order', () => {
    expect(symbols).toHaveLength(27)
    const ids = symbols.map((symbol) => /\bid="([^"]*)"/.exec(symbol[1])?.[1])
    expect(OS_KEYS.size).toBe(27)
    expect(new Set(ids)).toEqual(OS_KEYS)
    expect(ids).toEqual([...OS_KEYS].sort())
  })

  it('gives every symbol a 24 by 24 viewBox and a nonempty path', () => {
    for (const [, attributes, content] of symbols) {
      expect(/\bviewBox="([^"]*)"/.exec(attributes)?.[1]).toBe('0 0 24 24')
      const paths = [...content.matchAll(/<path\b[^>]*\sd="([^"]*)"[^>]*>/g)]
      expect(paths).toHaveLength(1)
      expect(paths[0][1].length).toBeGreaterThan(20)
    }
  })

  it('leaves coloring to CSS without fill, stroke, or style attributes', () => {
    expect(sprite).not.toContain('fill=')
    expect(sprite).not.toContain('stroke=')
    expect(sprite).not.toContain('style=')
  })

  it('uses one line per symbol with a trailing newline', () => {
    const lines = sprite.split('\n')
    expect(lines[0]).toBe('<svg xmlns="http://www.w3.org/2000/svg">')
    expect(lines.slice(1, -2)).toHaveLength(27)
    expect(lines.slice(1, -2).every((line) => /^<symbol .*<\/symbol>$/.test(line))).toBe(true)
    expect(lines.slice(-2)).toEqual(['</svg>', ''])
  })

  it('gives every key a brand tile colour and a readable mark colour', () => {
    expect(new Set(Object.keys(OS_COLORS))).toEqual(OS_KEYS)
    for (const { tile, mark } of Object.values(OS_COLORS)) {
      expect(tile).toMatch(/^#[0-9A-F]{6}$/)
      expect(['#FFFFFF', '#000000']).toContain(mark)
    }
    expect(OS_COLORS.debian).toEqual({ tile: '#A81D33', mark: '#FFFFFF' })
    expect(OS_COLORS.linux.mark).toBe('#000000')
  })
})
