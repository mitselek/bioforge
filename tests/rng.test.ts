import { describe, it, expect } from 'vitest'
import { makeRng } from '../src/core/rng.js'

describe('rng', () => {
  describe('determinism', () => {
    it('produces the same sequence for the same seed', () => {
      const a = makeRng(42)
      const b = makeRng(42)
      for (let i = 0; i < 10000; i++) {
        expect(a.float()).toBe(b.float())
      }
    })

    it('produces different sequences for different seeds', () => {
      const a = makeRng(1)
      const b = makeRng(2)
      let differences = 0
      for (let i = 0; i < 100; i++) {
        if (a.float() !== b.float()) differences++
      }
      expect(differences).toBeGreaterThan(95)
    })
  })

  describe('float', () => {
    it('returns values in [0, 1)', () => {
      const r = makeRng(1)
      for (let i = 0; i < 10000; i++) {
        const v = r.float()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
        expect(Number.isFinite(v)).toBe(true)
      }
    })
  })

  describe('floatInRange', () => {
    it('returns values in [a, b)', () => {
      const r = makeRng(7)
      for (let i = 0; i < 1000; i++) {
        const v = r.floatInRange(-2, 5)
        expect(v).toBeGreaterThanOrEqual(-2)
        expect(v).toBeLessThan(5)
      }
    })
  })

  describe('intInRange', () => {
    it('returns integers in [a, b] inclusive', () => {
      const r = makeRng(7)
      const seen = new Set<number>()
      for (let i = 0; i < 1000; i++) {
        const v = r.intInRange(3, 6)
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(3)
        expect(v).toBeLessThanOrEqual(6)
        seen.add(v)
      }
      expect(seen).toEqual(new Set([3, 4, 5, 6]))
    })
  })

  describe('gaussian', () => {
    it('has the right mean and stddev over many samples', () => {
      const r = makeRng(123)
      const samples: number[] = []
      for (let i = 0; i < 10000; i++) {
        samples.push(r.gaussian(5, 2))
      }
      const mean = samples.reduce((s, v) => s + v, 0) / samples.length
      const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length
      const stddev = Math.sqrt(variance)

      expect(Math.abs(mean - 5)).toBeLessThan(0.1)
      expect(Math.abs(stddev - 2)).toBeLessThan(0.4)
      samples.forEach((v) => {
        expect(Number.isFinite(v)).toBe(true)
      })
    })
  })

  describe('pick', () => {
    it('returns an element of the array', () => {
      const r = makeRng(9)
      const arr = ['a', 'b', 'c', 'd']
      for (let i = 0; i < 100; i++) {
        expect(arr).toContain(r.pick(arr))
      }
    })

    it('covers all elements over many calls', () => {
      const r = makeRng(9)
      const arr = [0, 1, 2, 3]
      const seen = new Set<number>()
      for (let i = 0; i < 1000; i++) seen.add(r.pick(arr))
      expect(seen).toEqual(new Set([0, 1, 2, 3]))
    })

    it('throws on empty array', () => {
      const r = makeRng(1)
      expect(() => r.pick([])).toThrow(/empty/)
    })
  })
})
