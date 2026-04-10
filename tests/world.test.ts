import { describe, it, expect } from 'vitest'
import {
  wrap,
  wrapPosition,
  wrapDelta,
  torusDistance,
  torusBearing,
  normalizeAngle,
} from '../src/core/world.js'

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

describe('world.torusBearing', () => {
  it('returns 0 when b is directly east of a', () => {
    expect(torusBearing({ x: 10, y: 10 }, { x: 20, y: 10 }, 80, 30)).toBeCloseTo(0)
  })

  it('returns π/2 when b is directly south', () => {
    expect(torusBearing({ x: 10, y: 10 }, { x: 10, y: 20 }, 80, 30)).toBeCloseTo(Math.PI / 2)
  })

  it('returns -π/2 when b is directly north', () => {
    expect(torusBearing({ x: 10, y: 10 }, { x: 10, y: 5 }, 80, 30)).toBeCloseTo(-Math.PI / 2)
  })

  it('returns π (or -π) when b is directly west', () => {
    const bearing = torusBearing({ x: 20, y: 10 }, { x: 10, y: 10 }, 80, 30)
    expect(Math.abs(Math.abs(bearing) - Math.PI)).toBeLessThan(1e-9)
  })

  it('uses wrap-aware shortest path (going west via wrap, not east the long way)', () => {
    // a at x=1, b at x=79: direct east is 78 units; wrap west is 2 units.
    // Bearing should point west (angle near ±π), not east (angle near 0).
    const bearing = torusBearing({ x: 1, y: 10 }, { x: 79, y: 10 }, 80, 30)
    expect(Math.abs(Math.abs(bearing) - Math.PI)).toBeLessThan(1e-9)
  })

  it('always returns values in [-π, π]', () => {
    for (let i = 0; i < 200; i++) {
      const a = { x: (i * 7.31) % 80, y: (i * 3.13) % 30 }
      const b = { x: (i * 11.17) % 80, y: (i * 5.71) % 30 }
      const angle = torusBearing(a, b, 80, 30)
      expect(angle).toBeGreaterThanOrEqual(-Math.PI)
      expect(angle).toBeLessThanOrEqual(Math.PI)
    }
  })
})

describe('world.normalizeAngle', () => {
  it('leaves angles in [-π, π] unchanged', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0)
    expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
  })

  it('wraps positive overflow', () => {
    expect(normalizeAngle(2 * Math.PI + 0.1)).toBeCloseTo(0.1)
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI)
  })

  it('wraps negative underflow', () => {
    expect(normalizeAngle(-2 * Math.PI - 0.1)).toBeCloseTo(-0.1)
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI)
  })

  it('handles extreme inputs without freezing (no while-loop)', () => {
    // Spec §1.3 forbids while-loop normalization because it freezes for
    // very large inputs. Verify by timing: 1e20 should normalize in
    // under 100ms (in practice, in microseconds).
    const start = Date.now()
    const v = normalizeAngle(1e20)
    expect(Date.now() - start).toBeLessThan(100)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(-Math.PI)
    expect(v).toBeLessThanOrEqual(Math.PI)
  })

  it('is idempotent', () => {
    const a = normalizeAngle(7.5)
    expect(normalizeAngle(a)).toBeCloseTo(a)
  })
})
