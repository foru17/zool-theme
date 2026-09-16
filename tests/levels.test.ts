import { describe, expect, it } from 'vitest'
import { levelFor } from '@/components/instruments'

describe('levelFor', () => {
  it('judges CPU against 50/85 using the printed figure', () => {
    expect(levelFor('cpu', 49.4)).toBe('good')
    expect(levelFor('cpu', 49.6)).toBe('warn')
    expect(levelFor('cpu', 84.4)).toBe('warn')
    expect(levelFor('cpu', 84.6)).toBe('danger')
  })

  it('judges memory against 70/90 using the printed figure', () => {
    expect(levelFor('memory', 69.4)).toBe('good')
    expect(levelFor('memory', 69.6)).toBe('warn')
    expect(levelFor('memory', 89.4)).toBe('warn')
    expect(levelFor('memory', 89.6)).toBe('danger')
    expect(levelFor('memory', 90)).toBe('danger')
  })

  it('judges disk against 80/92 using the printed figure', () => {
    expect(levelFor('disk', 79.4)).toBe('good')
    expect(levelFor('disk', 79.6)).toBe('warn')
    expect(levelFor('disk', 91.4)).toBe('warn')
    expect(levelFor('disk', 91.6)).toBe('danger')
  })

  it('keeps separate thresholds per metric', () => {
    expect(levelFor('cpu', 60)).toBe('warn')
    expect(levelFor('memory', 60)).toBe('good')
    expect(levelFor('disk', 60)).toBe('good')
  })
})
