import { describe, it, expect } from 'vitest'
import { wrap, wrapPosition, wrapDelta, torusDistance } from '../src/core/world.js'

describe('world.wrap', () => {
  it('wraps positive overflow', () => {
    expect(wrap(85, 80)).toBeCloseTo(5)
  })
  it('wraps negative underflow', () => {
    expect(wrap(-3, 80)).toBeCloseTo(77)
  })
  it('is idempotent', () => {
    const v = wrap(123.4, 80)
    expect(wrap(v, 80)).toBeCloseTo(v)
  })
  it('returns values in [0, size) for inputs across many magnitudes', () => {
    for (let i = -1000; i <= 1000; i += 13.7) {
      const w = wrap(i, 80)
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThan(80)
    }
  })
  it('returns 0 for the value at the size boundary', () => {
    expect(wrap(80, 80)).toBeCloseTo(0)
  })
})

describe('world.wrapPosition', () => {
  it('wraps both coordinates', () => {
    const p = wrapPosition({ x: 85, y: -3 }, 80, 30)
    expect(p.x).toBeCloseTo(5)
    expect(p.y).toBeCloseTo(27)
  })
  it('leaves in-range positions unchanged', () => {
    const p = wrapPosition({ x: 40, y: 15 }, 80, 30)
    expect(p.x).toBeCloseTo(40)
    expect(p.y).toBeCloseTo(15)
  })
})

describe('world.wrapDelta', () => {
  it('returns shortest signed delta for forward case', () => {
    expect(wrapDelta(5, 80)).toBe(5)
  })
  it('returns shortest signed delta for backward case', () => {
    expect(wrapDelta(75, 80)).toBe(-5)
  })
  it('handles negative inputs', () => {
    expect(wrapDelta(-75, 80)).toBe(5)
  })
  it('is in [-size/2, size/2]', () => {
    for (let i = -1000; i <= 1000; i += 13.7) {
      const d = wrapDelta(i, 80)
      expect(d).toBeGreaterThanOrEqual(-40)
      expect(d).toBeLessThanOrEqual(40)
    }
  })
})

describe('world.torusDistance', () => {
  it('is symmetric', () => {
    const a = { x: 5, y: 5 }
    const b = { x: 75, y: 25 }
    expect(torusDistance(a, b, 80, 30)).toBeCloseTo(torusDistance(b, a, 80, 30))
  })

  it('returns shortest wrap-aware distance', () => {
    // Direct distance: sqrt(78^2 + 28^2) ≈ 82.87
    // Wrap-aware: sqrt(2^2 + 2^2) ≈ 2.83
    const a = { x: 1, y: 1 }
    const b = { x: 79, y: 29 }
    expect(torusDistance(a, b, 80, 30)).toBeLessThan(5)
  })

  it('is zero for identical points', () => {
    const a = { x: 10, y: 10 }
    expect(torusDistance(a, a, 80, 30)).toBe(0)
  })

  it('never exceeds the torus half-diagonal', () => {
    // Use deterministic sampling so this is reproducible. Forbidden to use
    // Math.random() per spec §15.2 — here we use a simple linear congruence
    // so the test is seed-stable without a full RNG import.
    const max = Math.sqrt(40 * 40 + 15 * 15)
    for (let i = 0; i < 100; i++) {
      const a = { x: (i * 7.31) % 80, y: (i * 3.13) % 30 }
      const b = { x: (i * 11.17) % 80, y: (i * 5.71) % 30 }
      expect(torusDistance(a, b, 80, 30)).toBeLessThanOrEqual(max + 1e-9)
    }
  })

  it('matches Euclidean distance for points within half the torus dimension', () => {
    const a = { x: 10, y: 10 }
    const b = { x: 13, y: 14 }
    // Direct distance: sqrt(3^2 + 4^2) = 5
    expect(torusDistance(a, b, 80, 30)).toBeCloseTo(5)
  })
})
