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
})
