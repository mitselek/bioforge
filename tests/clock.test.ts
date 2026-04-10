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

  describe('tick counter', () => {
    it('starts at 0', () => {
      const c = makeClock({ baseHz: 30 })
      expect(c.tick).toBe(0)
    })

    it('increments by 1 on each advance', () => {
      const c = makeClock({ baseHz: 30 })
      c.advance()
      expect(c.tick).toBe(1)
      c.advance()
      c.advance()
      expect(c.tick).toBe(3)
    })
  })

  describe('pause', () => {
    it('defaults to false', () => {
      const c = makeClock({ baseHz: 30 })
      expect(c.paused).toBe(false)
    })

    it('advance is a no-op when paused', () => {
      const c = makeClock({ baseHz: 30 })
      c.advance()
      c.advance()
      expect(c.tick).toBe(2)
      c.paused = true
      c.advance()
      c.advance()
      c.advance()
      expect(c.tick).toBe(2)
    })

    it('paused setter round-trips', () => {
      const c = makeClock({ baseHz: 30 })
      c.paused = true
      expect(c.paused).toBe(true)
      c.paused = false
      expect(c.paused).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears tick to 0', () => {
      const c = makeClock({ baseHz: 30 })
      c.advance()
      c.advance()
      c.advance()
      expect(c.tick).toBe(3)
      c.reset()
      expect(c.tick).toBe(0)
    })

    it('restores speed to default (1.0)', () => {
      const c = makeClock({ baseHz: 30 })
      c.speed = 5
      expect(c.speed).toBe(5)
      c.reset()
      expect(c.speed).toBe(1.0)
    })

    it('clears paused flag', () => {
      const c = makeClock({ baseHz: 30 })
      c.paused = true
      c.reset()
      expect(c.paused).toBe(false)
    })

    it('does NOT reset baseHz', () => {
      const c = makeClock({ baseHz: 30 })
      c.reset()
      expect(c.baseHz).toBe(30)
      expect(c.dt).toBeCloseTo(1 / 30, 10)
    })
  })
})
