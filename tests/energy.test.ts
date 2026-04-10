import { describe, it, expect } from 'vitest'
import { makeLedger } from '../src/core/energy.js'

describe('energy ledger', () => {
  describe('initial state', () => {
    it('reports the initial soil total', () => {
      const l = makeLedger({ totalEnergy: 1000, initialSoil: 1000 })
      expect(l.totalEnergy()).toBe(1000)
      expect(l.get({ kind: 'soil' })).toBe(1000)
    })
  })

  describe('transfer', () => {
    it('debits from and credits to', () => {
      const l = makeLedger({ totalEnergy: 1000, initialSoil: 1000 })
      l.register({ kind: 'entity', id: 1 }, 0)
      l.transfer({ kind: 'soil' }, { kind: 'entity', id: 1 }, 300)
      expect(l.get({ kind: 'soil' })).toBe(700)
      expect(l.get({ kind: 'entity', id: 1 })).toBe(300)
      expect(l.totalEnergy()).toBe(1000)
    })

    it('rejects NaN amount', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      expect(() => {
        l.transfer({ kind: 'soil' }, { kind: 'entity', id: 1 }, NaN)
      }).toThrow(/non-finite/)
    })

    it('rejects Infinity amount', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      expect(() => {
        l.transfer({ kind: 'soil' }, { kind: 'entity', id: 1 }, Infinity)
      }).toThrow(/non-finite/)
    })

    it('rejects negative amount', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      expect(() => {
        l.transfer({ kind: 'soil' }, { kind: 'entity', id: 1 }, -5)
      }).toThrow(/negative/)
    })

    it('zero amount is a no-op', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      expect(() => {
        l.transfer({ kind: 'soil' }, { kind: 'entity', id: 1 }, 0)
      }).not.toThrow()
      expect(l.get({ kind: 'soil' })).toBe(100)
      expect(l.get({ kind: 'entity', id: 1 })).toBe(0)
    })

    it('throws on overdraw', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      expect(() => {
        l.transfer({ kind: 'soil' }, { kind: 'entity', id: 1 }, 200)
      }).toThrow(/overdraw/)
    })

    it('throws on transfer from unknown pool', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      expect(() => {
        l.transfer({ kind: 'entity', id: 999 }, { kind: 'entity', id: 1 }, 10)
      }).toThrow(/unknown/)
    })

    it('throws on transfer to unknown pool', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      expect(() => {
        l.transfer({ kind: 'soil' }, { kind: 'entity', id: 999 }, 10)
      }).toThrow(/unknown/)
    })
  })

  describe('register and unregister', () => {
    it('registering a pool with initial 0 does not change total', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      expect(l.totalEnergy()).toBe(100)
    })

    it('refuses to register an existing pool twice', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      expect(() => {
        l.register({ kind: 'entity', id: 1 }, 0)
      }).toThrow(/already registered/)
    })

    it('unregister requires an empty pool', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'corpse', id: 1 }, 0)
      l.transfer({ kind: 'soil' }, { kind: 'corpse', id: 1 }, 30)
      expect(() => {
        l.unregister({ kind: 'corpse', id: 1 })
      }).toThrow(/non-empty/)
      l.transfer({ kind: 'corpse', id: 1 }, { kind: 'soil' }, 30)
      expect(() => {
        l.unregister({ kind: 'corpse', id: 1 })
      }).not.toThrow()
      expect(l.totalEnergy()).toBe(100)
    })

    it('unregister throws on unknown pool', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      expect(() => {
        l.unregister({ kind: 'entity', id: 999 })
      }).toThrow(/unknown/)
    })
  })

  describe('pool key uniqueness', () => {
    it('distinguishes pool kinds by id', () => {
      const l = makeLedger({ totalEnergy: 100, initialSoil: 100 })
      l.register({ kind: 'entity', id: 1 }, 0)
      l.register({ kind: 'corpse', id: 1 }, 0)
      // entity#1 and corpse#1 are different pools even with same id
      l.transfer({ kind: 'soil' }, { kind: 'entity', id: 1 }, 10)
      l.transfer({ kind: 'soil' }, { kind: 'corpse', id: 1 }, 20)
      expect(l.get({ kind: 'entity', id: 1 })).toBe(10)
      expect(l.get({ kind: 'corpse', id: 1 })).toBe(20)
      expect(l.totalEnergy()).toBe(100)
    })
  })
})
