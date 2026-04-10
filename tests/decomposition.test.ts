import { describe, it, expect } from 'vitest'
import { applyDecomposerEating, applyCorpseDecay } from '../src/core/decomposition.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig, makeConfig } from '../src/core/config.js'
import { makeLedger } from '../src/core/energy.js'
import { makeDeadMatterRegistry } from '../src/core/deadMatter.js'
import type { Corpse } from '../src/core/deadMatter.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'

// Story 4.4 AC4.4.1-4 — Decomposer eating dead matter + corpse passive decay
// Spec §3.5: unified eating model; §4.1: corpse decay to soil; §3.6: decomposer stats; §2: conservation

const cfg = defaultConfig()
const dt = 1 / 30

// decomposer: eatRate=1.67, efficiency=0.9
// corpseDecayRate=1.0

function makeCorpseWithLedger(
  corpseEnergy: number,
  decomposerEnergy = 100,
): {
  decomposer: ReturnType<typeof makeEntity>
  corpse: Corpse
  ledger: ReturnType<typeof makeLedger>
} {
  const rng = makeRng(1)
  const decomposer = makeEntity({
    id: entityId(10),
    species: 'decomposer',
    position: { x: 40, y: 15 },
    orientation: 0,
    energy: decomposerEnergy,
    lifespan: 900,
    maturityAge: 300,
    genome: randomGenome(rng, cfg),
    stats: cfg.species.decomposer,
  })
  const registry = makeDeadMatterRegistry()
  const corpse = registry.addCorpse({ x: 40, y: 15 }, corpseEnergy)
  if (corpse === null) throw new Error('corpse should not be null for positive energy')
  const totalE = decomposerEnergy + corpseEnergy + 500
  const ledger = makeLedger({ totalEnergy: totalE, initialSoil: 500 })
  ledger.register({ kind: 'entity', id: 10 }, decomposerEnergy)
  ledger.register({ kind: 'corpse', id: corpse.id }, corpseEnergy)
  return { decomposer, corpse, ledger }
}

// ─── applyDecomposerEating ────────────────────────────────────────────────────

describe('applyDecomposerEating', () => {
  describe('AC4.4.1 — unified eating model against corpse', () => {
    it('eaten = min(eatRate * dt, corpse.energy)', () => {
      // eatRate=1.67, dt=1/30 → eaten=1.67/30≈0.05567; corpse=100 → full eatRate applies
      const { decomposer, corpse, ledger } = makeCorpseWithLedger(100)
      const expectedEaten = cfg.species.decomposer.eatRate * dt
      applyDecomposerEating(decomposer, corpse, dt, ledger, cfg)
      expect(corpse.energy).toBeCloseTo(100 - expectedEaten, 8)
    })

    it('decomposer energy increases by eaten amount', () => {
      const { decomposer, corpse, ledger } = makeCorpseWithLedger(100)
      const expectedEaten = cfg.species.decomposer.eatRate * dt
      const energyBefore = decomposer.energy
      applyDecomposerEating(decomposer, corpse, dt, ledger, cfg)
      expect(decomposer.energy).toBeCloseTo(energyBefore + expectedEaten, 8)
    })

    it('eaten is clamped to remaining corpse energy', () => {
      // corpse has only 0.01 energy, eatRate*dt≈0.0557 → eaten=0.01
      const { decomposer, corpse, ledger } = makeCorpseWithLedger(0.01)
      applyDecomposerEating(decomposer, corpse, dt, ledger, cfg)
      expect(corpse.energy).toBeCloseTo(0, 10)
      expect(decomposer.energy).toBeCloseTo(100 + 0.01, 8)
    })

    it('decomposer wasteBuffer increases by eaten * (1 - efficiency)', () => {
      // wasted = eaten * (1 - 0.9) = eaten * 0.1
      const { decomposer, corpse, ledger } = makeCorpseWithLedger(100)
      const expectedEaten = cfg.species.decomposer.eatRate * dt
      const expectedWaste = expectedEaten * (1 - cfg.species.decomposer.efficiency)
      applyDecomposerEating(decomposer, corpse, dt, ledger, cfg)
      expect(decomposer.wasteBuffer).toBeCloseTo(expectedWaste, 8)
    })

    it('energy is transferred via ledger: entity pool increases, corpse pool decreases', () => {
      const { decomposer, corpse, ledger } = makeCorpseWithLedger(100)
      const expectedEaten = cfg.species.decomposer.eatRate * dt
      applyDecomposerEating(decomposer, corpse, dt, ledger, cfg)
      expect(ledger.get({ kind: 'entity', id: 10 })).toBeCloseTo(100 + expectedEaten, 8)
      expect(ledger.get({ kind: 'corpse', id: corpse.id })).toBeCloseTo(100 - expectedEaten, 8)
    })

    it('total ledger energy is conserved', () => {
      const { decomposer, corpse, ledger } = makeCorpseWithLedger(100)
      const totalBefore = ledger.totalEnergy()
      applyDecomposerEating(decomposer, corpse, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 8)
    })
  })

  describe('AC4.4.1 — unified eating model against poop', () => {
    it('decomposer can eat poop using the same model', () => {
      const rng = makeRng(1)
      const decomposer = makeEntity({
        id: entityId(10),
        species: 'decomposer',
        position: { x: 40, y: 15 },
        orientation: 0,
        energy: 100,
        lifespan: 900,
        maturityAge: 300,
        genome: randomGenome(rng, cfg),
        stats: cfg.species.decomposer,
      })
      const registry = makeDeadMatterRegistry()
      const poop = registry.addPoop({ x: 40, y: 15 }, 50)
      const ledger = makeLedger({ totalEnergy: 100 + 50 + 500, initialSoil: 500 })
      ledger.register({ kind: 'entity', id: 10 }, 100)
      ledger.register({ kind: 'poop', id: poop.id }, 50)
      const expectedEaten = cfg.species.decomposer.eatRate * dt
      applyDecomposerEating(decomposer, poop, dt, ledger, cfg)
      expect(poop.energy).toBeCloseTo(50 - expectedEaten, 8)
      expect(decomposer.energy).toBeCloseTo(100 + expectedEaten, 8)
    })
  })

  describe('AC4.4.2 — multiple decomposers on same corpse, sequential, each clamped', () => {
    it('second decomposer sees reduced corpse energy from first eat', () => {
      // Two decomposers eat same corpse sequentially.
      // corpse=0.08, each eatRate*dt≈0.0557
      // first eats 0.0557 → corpse=0.0243
      // second eats 0.0243 (clamped) → corpse=0
      const rng2 = makeRng(2)
      const decomposer2 = makeEntity({
        id: entityId(11),
        species: 'decomposer',
        position: { x: 41, y: 15 },
        orientation: 0,
        energy: 100,
        lifespan: 900,
        maturityAge: 300,
        genome: randomGenome(rng2, cfg),
        stats: cfg.species.decomposer,
      })
      const corpseE = 0.08
      const totalE = 100 + 100 + corpseE + 500
      const ledger = makeLedger({ totalEnergy: totalE, initialSoil: 500 })
      ledger.register({ kind: 'entity', id: 10 }, 100)
      ledger.register({ kind: 'entity', id: 11 }, 100)
      const registry = makeDeadMatterRegistry()
      const corpse = registry.addCorpse({ x: 40, y: 15 }, corpseE)
      if (corpse === null) throw new Error('corpse should not be null')
      ledger.register({ kind: 'corpse', id: corpse.id }, corpseE)

      const rng1 = makeRng(1)
      const decomposer1 = makeEntity({
        id: entityId(10),
        species: 'decomposer',
        position: { x: 40, y: 15 },
        orientation: 0,
        energy: 100,
        lifespan: 900,
        maturityAge: 300,
        genome: randomGenome(rng1, cfg),
        stats: cfg.species.decomposer,
      })

      applyDecomposerEating(decomposer1, corpse, dt, ledger, cfg)
      const afterFirst = corpse.energy
      applyDecomposerEating(decomposer2, corpse, dt, ledger, cfg)

      // first took min(0.0557, 0.08)=0.0557 → corpse≈0.0243
      expect(afterFirst).toBeCloseTo(corpseE - cfg.species.decomposer.eatRate * dt, 8)
      // second took remaining ≈0.0243
      expect(corpse.energy).toBeCloseTo(0, 8)
    })
  })
})

// ─── applyCorpseDecay ─────────────────────────────────────────────────────────

describe('applyCorpseDecay', () => {
  function makeDecayLedger(corpseEnergy: number): {
    corpse: Corpse
    ledger: ReturnType<typeof makeLedger>
  } {
    const registry = makeDeadMatterRegistry()
    const corpse = registry.addCorpse({ x: 40, y: 15 }, corpseEnergy)
    if (corpse === null) throw new Error('corpse should not be null')
    const ledger = makeLedger({ totalEnergy: corpseEnergy + 500, initialSoil: 500 })
    ledger.register({ kind: 'corpse', id: corpse.id }, corpseEnergy)
    return { corpse, ledger }
  }

  describe('AC4.4.3 — passive decay transfers energy to soil', () => {
    it('corpse energy decreases by corpseDecayRate * dt', () => {
      // corpseDecayRate=1.0, dt=1/30 → decay=1/30≈0.03333
      const { corpse, ledger } = makeDecayLedger(100)
      const expectedDecay = cfg.corpseDecayRate * dt
      applyCorpseDecay(corpse, dt, ledger, cfg)
      expect(corpse.energy).toBeCloseTo(100 - expectedDecay, 8)
    })

    it('soil increases by decay amount', () => {
      const { corpse, ledger } = makeDecayLedger(100)
      const soilBefore = ledger.get({ kind: 'soil' })
      const expectedDecay = cfg.corpseDecayRate * dt
      applyCorpseDecay(corpse, dt, ledger, cfg)
      expect(ledger.get({ kind: 'soil' })).toBeCloseTo(soilBefore + expectedDecay, 8)
    })

    it('decay is clamped to remaining corpse energy when near-empty', () => {
      // corpse=0.01 < decay=0.03333 → clamp to 0.01, corpse reaches 0
      const { corpse, ledger } = makeDecayLedger(0.01)
      applyCorpseDecay(corpse, dt, ledger, cfg)
      expect(corpse.energy).toBeCloseTo(0, 10)
    })

    it('total ledger energy is conserved after decay', () => {
      const { corpse, ledger } = makeDecayLedger(100)
      const totalBefore = ledger.totalEnergy()
      applyCorpseDecay(corpse, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 8)
    })
  })

  describe('AC4.4.4 — zero-energy corpse flagged for removal', () => {
    it('returns false when corpse energy remains > 0 after decay', () => {
      const { corpse, ledger } = makeDecayLedger(100)
      const result = applyCorpseDecay(corpse, dt, ledger, cfg)
      expect(result).toBe(false)
    })

    it('returns true when corpse energy reaches zero after decay', () => {
      // corpse=0.02, decay=0.03333 → clamped to 0.02, corpse.energy=0 → flagged
      const { corpse, ledger } = makeDecayLedger(0.02)
      const result = applyCorpseDecay(corpse, dt, ledger, cfg)
      expect(result).toBe(true)
    })

    it('returns true when corpse is exactly consumed by decay', () => {
      // corpse energy exactly = decay amount → energy=0 after
      const cfg2 = makeConfig({ corpseDecayRate: 3.0 })
      const exactDecay = cfg2.corpseDecayRate * dt // 3.0/30 = 0.1
      const registry = makeDeadMatterRegistry()
      const corpse = registry.addCorpse({ x: 40, y: 15 }, exactDecay)
      if (corpse === null) throw new Error('corpse should not be null')
      const ledger = makeLedger({ totalEnergy: exactDecay + 500, initialSoil: 500 })
      ledger.register({ kind: 'corpse', id: corpse.id }, exactDecay)
      const result = applyCorpseDecay(corpse, dt, ledger, cfg2)
      expect(result).toBe(true)
      expect(corpse.energy).toBeCloseTo(0, 10)
    })
  })
})
