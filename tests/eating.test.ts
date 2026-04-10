import { describe, it, expect } from 'vitest'
import { applyEating } from '../src/core/eating.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'
import { makeLedger } from '../src/core/energy.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'
import type { Species } from '../src/core/config.js'

// Story 4.4 AC1 — predation energy transfer
// Spec §3.5 (unified predation model), §3.6 (eatRate, efficiency), §2 (conservation)

const cfg = defaultConfig()
const dt = 1 / 30

function makeEntityWithLedger(
  species: Species,
  energy: number,
  id: number,
): {
  entity: ReturnType<typeof makeEntity>
  pool: { kind: 'entity'; id: number }
} {
  const rng = makeRng(id) // different seed per entity to vary genomes
  const stats = cfg.species[species]
  const entity = makeEntity({
    id: entityId(id),
    species,
    position: { x: 40, y: 15 },
    orientation: 0,
    energy,
    lifespan: 900,
    maturityAge: 300,
    genome: randomGenome(rng, cfg),
    stats,
  })
  return { entity, pool: { kind: 'entity', id } }
}

function makeEatingLedger(
  predatorEnergy: number,
  preyEnergy: number,
): ReturnType<typeof makeLedger> {
  const total = predatorEnergy + preyEnergy + 1000
  const ledger = makeLedger({ totalEnergy: total, initialSoil: 1000 })
  ledger.register({ kind: 'entity', id: 1 }, predatorEnergy)
  ledger.register({ kind: 'entity', id: 2 }, preyEnergy)
  return ledger
}

describe('applyEating', () => {
  describe('normal tick — prey has more energy than eatRate*dt', () => {
    // herbivore (id=1) eats plant (id=2): eatRate=5, efficiency=0.7, dt=1/30
    // eaten = 5*(1/30) ≈ 0.1667, gained = eaten*0.7 ≈ 0.1167, wasted = eaten*0.3 = 0.05

    it('transfers eaten energy from prey pool to predator pool via ledger', () => {
      // AC1+2: predator ledger balance increases by full `eaten` amount
      const { entity: predator } = makeEntityWithLedger('herbivore', 50, 1)
      const { entity: prey } = makeEntityWithLedger('plant', 100, 2)
      const ledger = makeEatingLedger(50, 100)
      const eaten = cfg.species.herbivore.eatRate * dt
      applyEating(predator, prey, dt, ledger, cfg)
      expect(ledger.get({ kind: 'entity', id: 1 })).toBeCloseTo(50 + eaten, 10)
    })

    it('prey ledger balance decreases by eaten amount', () => {
      // AC2: prey pool debited by `eaten`
      const { entity: predator } = makeEntityWithLedger('herbivore', 50, 1)
      const { entity: prey } = makeEntityWithLedger('plant', 100, 2)
      const ledger = makeEatingLedger(50, 100)
      const eaten = cfg.species.herbivore.eatRate * dt
      applyEating(predator, prey, dt, ledger, cfg)
      expect(ledger.get({ kind: 'entity', id: 2 })).toBeCloseTo(100 - eaten, 10)
    })

    it('predator entity.energy reflects ledger balance after eating', () => {
      // AC1: entity.energy stays in sync with ledger
      const { entity: predator } = makeEntityWithLedger('herbivore', 50, 1)
      const { entity: prey } = makeEntityWithLedger('plant', 100, 2)
      const ledger = makeEatingLedger(50, 100)
      const eaten = cfg.species.herbivore.eatRate * dt
      applyEating(predator, prey, dt, ledger, cfg)
      expect(predator.energy).toBeCloseTo(50 + eaten, 10)
    })

    it('prey entity.energy reflects ledger balance after eating', () => {
      // AC2: prey.energy stays in sync with ledger
      const { entity: predator } = makeEntityWithLedger('herbivore', 50, 1)
      const { entity: prey } = makeEntityWithLedger('plant', 100, 2)
      const ledger = makeEatingLedger(50, 100)
      const eaten = cfg.species.herbivore.eatRate * dt
      applyEating(predator, prey, dt, ledger, cfg)
      expect(prey.energy).toBeCloseTo(100 - eaten, 10)
    })

    it('predator wasteBuffer increases by wasted = eaten * (1 - efficiency)', () => {
      // AC3: inefficiency portion tracked in wasteBuffer (not ledger)
      const { entity: predator } = makeEntityWithLedger('herbivore', 50, 1)
      const { entity: prey } = makeEntityWithLedger('plant', 100, 2)
      const ledger = makeEatingLedger(50, 100)
      const eaten = cfg.species.herbivore.eatRate * dt
      const wasted = eaten * (1 - cfg.species.herbivore.efficiency)
      applyEating(predator, prey, dt, ledger, cfg)
      expect(predator.wasteBuffer).toBeCloseTo(wasted, 10)
    })
  })

  describe('carnivore kills herbivore in one tick (eatRate=10000)', () => {
    // carnivore (id=1) eats herbivore (id=2): eatRate=10000, efficiency=0.6
    // eaten = min(10000*(1/30), 100) = 100, gained=60, wasted=40

    it('carnivore eats entire prey in one tick when eatRate*dt >> prey.energy', () => {
      // AC7: eaten = prey.energy (not eatRate*dt)
      const { entity: predator } = makeEntityWithLedger('carnivore', 200, 1)
      const { entity: prey } = makeEntityWithLedger('herbivore', 100, 2)
      const ledger = makeEatingLedger(200, 100)
      applyEating(predator, prey, dt, ledger, cfg)
      expect(prey.energy).toBeCloseTo(0, 10)
      expect(ledger.get({ kind: 'entity', id: 2 })).toBeCloseTo(0, 10)
    })

    it('carnivore wasteBuffer gets wasted = 100 * (1-0.6) = 40', () => {
      // AC3: correct waste fraction for carnivore
      const { entity: predator } = makeEntityWithLedger('carnivore', 200, 1)
      const { entity: prey } = makeEntityWithLedger('herbivore', 100, 2)
      const ledger = makeEatingLedger(200, 100)
      applyEating(predator, prey, dt, ledger, cfg)
      const expectedWaste = 100 * (1 - cfg.species.carnivore.efficiency)
      expect(predator.wasteBuffer).toBeCloseTo(expectedWaste, 10)
    })
  })

  describe('partial prey — prey energy < eatRate*dt', () => {
    // herbivore eats plant with only 0.05 energy (< 5/30 ≈ 0.167)
    // eaten = 0.05 (clamped to prey.energy)

    it('eaten is clamped to prey energy when prey is nearly exhausted', () => {
      // AC6: eaten = min(eatRate*dt, prey.energy) = 0.05
      const { entity: predator } = makeEntityWithLedger('herbivore', 50, 1)
      const { entity: prey } = makeEntityWithLedger('plant', 0.05, 2)
      const ledger = makeEatingLedger(50, 0.05)
      applyEating(predator, prey, dt, ledger, cfg)
      expect(prey.energy).toBeCloseTo(0, 10)
    })

    it('wasteBuffer gets wasted fraction of the clamped amount', () => {
      // AC3: waste proportional to what was actually eaten
      const { entity: predator } = makeEntityWithLedger('herbivore', 50, 1)
      const { entity: prey } = makeEntityWithLedger('plant', 0.05, 2)
      const ledger = makeEatingLedger(50, 0.05)
      const expectedWaste = 0.05 * (1 - cfg.species.herbivore.efficiency)
      applyEating(predator, prey, dt, ledger, cfg)
      expect(predator.wasteBuffer).toBeCloseTo(expectedWaste, 10)
    })
  })

  describe('energy conservation', () => {
    it('totalEnergy is unchanged after herbivore eats plant', () => {
      // AC5: full ledger sum conserved
      const { entity: predator } = makeEntityWithLedger('herbivore', 50, 1)
      const { entity: prey } = makeEntityWithLedger('plant', 100, 2)
      const ledger = makeEatingLedger(50, 100)
      const totalBefore = ledger.totalEnergy()
      applyEating(predator, prey, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })

    it('totalEnergy is unchanged after carnivore kills herbivore', () => {
      // AC5: conservation holds for one-shot kill
      const { entity: predator } = makeEntityWithLedger('carnivore', 200, 1)
      const { entity: prey } = makeEntityWithLedger('herbivore', 100, 2)
      const ledger = makeEatingLedger(200, 100)
      const totalBefore = ledger.totalEnergy()
      applyEating(predator, prey, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })
  })
})
