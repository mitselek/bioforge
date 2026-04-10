import { describe, it, expect } from 'vitest'
import { makeClock } from '../src/core/clock.js'

describe('clock', () => {
  describe('dt and speed', () => {
    it('has dt = 1/baseHz at speed 1.0', () => {
      const c = makeClock({ baseHz: 30 })
      expect(c.dt).toBeCloseTo(1 / 30, 10)
    })

    it('scales dt with speed', () => {
      const c = makeClock({ baseHz: 30 })
      c.speed = 2.0
      expect(c.dt).toBeCloseTo(2 / 30, 10)
      c.speed = 0.5
      expect(c.dt).toBeCloseTo(0.5 / 30, 10)
    })
  })

  describe('speed clamping', () => {
    it('clamps non-finite speed to 1.0 (NaN guard, spec §15.2)', () => {
      const c = makeClock({ baseHz: 30 })
      c.speed = NaN
      expect(c.speed).toBe(1.0)
      c.speed = Infinity
      expect(c.speed).toBe(1.0)
      c.speed = -Infinity
      expect(c.speed).toBe(1.0)
    })

    it('clamps speed below minimum to 0.1', () => {
      const c = makeClock({ baseHz: 30 })
      c.speed = 0
      expect(c.speed).toBe(0.1)
      c.speed = -5
      expect(c.speed).toBe(0.1)
    })

    it('clamps speed above maximum to 10', () => {
      const c = makeClock({ baseHz: 30 })
      c.speed = 100
      expect(c.speed).toBe(10)
    })
  })

  describe('construction', () => {
    it('rejects invalid baseHz', () => {
      expect(() => makeClock({ baseHz: 0 })).toThrow()
      expect(() => makeClock({ baseHz: -1 })).toThrow()
      expect(() => makeClock({ baseHz: NaN })).toThrow()
    })
  })
})
