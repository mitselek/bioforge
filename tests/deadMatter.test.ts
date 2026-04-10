import { describe, it, expect } from 'vitest'
import { makeDeadMatterRegistry } from '../src/core/deadMatter.js'

describe('deadMatter', () => {
  describe('registry basics', () => {
    it('starts empty for all three kinds', () => {
      const reg = makeDeadMatterRegistry()
      expect([...reg.corpses()]).toHaveLength(0)
      expect([...reg.poop()]).toHaveLength(0)
      expect([...reg.compost()]).toHaveLength(0)
    })

    it('adds and retrieves a corpse', () => {
      const reg = makeDeadMatterRegistry()
      const c = reg.addCorpse({ x: 10, y: 20 }, 50)
      expect(c).not.toBeNull()
      if (c !== null) {
        expect(c.position).toEqual({ x: 10, y: 20 })
        expect(c.energy).toBe(50)
      }
      expect([...reg.corpses()]).toHaveLength(1)
    })

    it('adds and retrieves poop', () => {
      const reg = makeDeadMatterRegistry()
      const p = reg.addPoop({ x: 5, y: 5 }, 10)
      expect(p.position).toEqual({ x: 5, y: 5 })
      expect(p.energy).toBe(10)
      expect([...reg.poop()]).toHaveLength(1)
    })

    it('adds and retrieves compost', () => {
      const reg = makeDeadMatterRegistry()
      const c = reg.addCompost({ x: 3, y: 7 }, 12)
      expect(c.position).toEqual({ x: 3, y: 7 })
      expect(c.energy).toBe(12)
      expect([...reg.compost()]).toHaveLength(1)
    })
  })

  describe('ID uniqueness and monotonicity', () => {
    it('assigns monotonically increasing IDs per kind', () => {
      const reg = makeDeadMatterRegistry()
      const c1 = reg.addCorpse({ x: 0, y: 0 }, 10)
      const c2 = reg.addCorpse({ x: 1, y: 1 }, 20)
      expect(c1).not.toBeNull()
      expect(c2).not.toBeNull()
      if (c1 !== null && c2 !== null) {
        expect(c2.id).toBeGreaterThan(c1.id)
      }

      const p1 = reg.addPoop({ x: 0, y: 0 }, 5)
      const p2 = reg.addPoop({ x: 1, y: 1 }, 8)
      expect(p2.id).toBeGreaterThan(p1.id)
    })

    it('IDs are unique across multiple adds and removes', () => {
      const reg = makeDeadMatterRegistry()
      const c1 = reg.addCorpse({ x: 0, y: 0 }, 10)
      expect(c1).not.toBeNull()
      if (c1 !== null) {
        reg.removeCorpse(c1.id)
        const c2 = reg.addCorpse({ x: 1, y: 1 }, 20)
        expect(c2).not.toBeNull()
        if (c2 !== null) {
          expect(c2.id).not.toBe(c1.id) // ID not reused
        }
      }
    })
  })

  describe('removal', () => {
    it('removes a corpse by ID', () => {
      const reg = makeDeadMatterRegistry()
      const c = reg.addCorpse({ x: 0, y: 0 }, 10)
      expect(c).not.toBeNull()
      if (c !== null) {
        reg.removeCorpse(c.id)
      }
      expect([...reg.corpses()]).toHaveLength(0)
    })

    it('removes poop by ID', () => {
      const reg = makeDeadMatterRegistry()
      const p = reg.addPoop({ x: 0, y: 0 }, 5)
      reg.removePoop(p.id)
      expect([...reg.poop()]).toHaveLength(0)
    })

    it('removes compost by ID', () => {
      const reg = makeDeadMatterRegistry()
      const c = reg.addCompost({ x: 0, y: 0 }, 8)
      reg.removeCompost(c.id)
      expect([...reg.compost()]).toHaveLength(0)
    })
  })

  describe('zero-energy elision (spec §4.1)', () => {
    it('does not add a corpse with zero energy', () => {
      const reg = makeDeadMatterRegistry()
      const result = reg.addCorpse({ x: 0, y: 0 }, 0)
      expect(result).toBeNull()
      expect([...reg.corpses()]).toHaveLength(0)
    })

    it('does not add a corpse with negative energy', () => {
      const reg = makeDeadMatterRegistry()
      const result = reg.addCorpse({ x: 0, y: 0 }, -5)
      expect(result).toBeNull()
      expect([...reg.corpses()]).toHaveLength(0)
    })

    it('allows zero-energy poop (poop does not elide per spec §4.2)', () => {
      // Spec only elides zero-energy CORPSES, not poop or compost.
      // But waste deposition always drops POOP_THRESHOLD+ energy,
      // so zero-energy poop shouldn't happen in practice.
      // For now, allow it — the registry is permissive on poop/compost.
      const reg = makeDeadMatterRegistry()
      const p = reg.addPoop({ x: 0, y: 0 }, 0)
      expect(p).not.toBeNull()
    })
  })

  describe('getCorpse / getPoop / getCompost by ID', () => {
    it('returns the item by ID', () => {
      const reg = makeDeadMatterRegistry()
      const c = reg.addCorpse({ x: 5, y: 5 }, 30)
      expect(c).not.toBeNull()
      if (c !== null) {
        const found = reg.getCorpse(c.id)
        expect(found).not.toBeUndefined()
        expect(found?.energy).toBe(30)
      }
    })

    it('returns undefined for unknown ID', () => {
      const reg = makeDeadMatterRegistry()
      expect(reg.getCorpse(999 as never)).toBeUndefined()
    })
  })
})
