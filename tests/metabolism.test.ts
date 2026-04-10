import { describe, it, expect } from 'vitest'
import { applyMetabolism } from '../src/core/metabolism.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'
import { makeLedger } from '../src/core/energy.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'
import type { Species } from '../src/core/config.js'

// Story 4.2 AC1 — base metabolic energy drain
// Spec §5.1 (metabolism cost to soil), §5.2 (age increment), §3.6 (rates), §2 (conservation)

const cfg = defaultConfig()
const dt = 1 / 30

function makeEntityWithLedger(
  species: Species,
  energy: number,
): {
  entity: ReturnType<typeof makeEntity>
  ledger: ReturnType<typeof makeLedger>
} {
  const rng = makeRng(1)
  const stats = cfg.species[species]
  const entity = makeEntity({
    id: entityId(1),
    species,
    position: { x: 40, y: 15 },
    orientation: 0,
    energy,
    lifespan: 900,
    maturityAge: 300,
    genome: randomGenome(rng, cfg),
    stats,
  })
  const ledger = makeLedger({ totalEnergy: energy + 1000, initialSoil: 1000 })
  ledger.register({ kind: 'entity', id: 1 }, energy)
  return { entity, ledger }
}

describe('applyMetabolism', () => {
  describe('energy drain', () => {
    it('drains baseMetabolicRate * dt from herbivore energy', () => {
      // AC1: herbivore rate=0.05, cost=0.05*(1/30)≈0.00167
      const { entity, ledger } = makeEntityWithLedger('herbivore', 100)
      const expectedCost = cfg.species.herbivore.baseMetabolicRate * dt
      applyMetabolism(entity, dt, ledger)
      expect(entity.energy).toBeCloseTo(100 - expectedCost, 10)
    })

    it('transfers drained energy to soil', () => {
      // AC1: soil increases by exactly the amount drained from entity
      const { entity, ledger } = makeEntityWithLedger('herbivore', 100)
      const soilBefore = ledger.get({ kind: 'soil' })
      const expectedCost = cfg.species.herbivore.baseMetabolicRate * dt
      applyMetabolism(entity, dt, ledger)
      expect(ledger.get({ kind: 'soil' })).toBeCloseTo(soilBefore + expectedCost, 10)
    })
  })

  describe('age increment', () => {
    it('increments entity.age by 1 each call', () => {
      // AC2: age ticks up regardless of species or energy
      const { entity, ledger } = makeEntityWithLedger('herbivore', 100)
      expect(entity.age).toBe(0)
      applyMetabolism(entity, dt, ledger)
      expect(entity.age).toBe(1)
      applyMetabolism(entity, dt, ledger)
      expect(entity.age).toBe(2)
    })
  })

  describe('energy conservation', () => {
    it('totalEnergy is unchanged after metabolism', () => {
      // AC3: ledger sum before === ledger sum after
      const { entity, ledger } = makeEntityWithLedger('carnivore', 200)
      const totalBefore = ledger.totalEnergy()
      applyMetabolism(entity, dt, ledger)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })
  })

  describe('all four species', () => {
    const cases: [Species, number][] = [
      ['plant', 0.01],
      ['herbivore', 0.05],
      ['carnivore', 0.1],
      ['decomposer', 0.02],
    ]

    for (const [species, rate] of cases) {
      it(`drains correct rate for ${species} (rate=${String(rate)})`, () => {
        // AC4: each species has its own baseMetabolicRate
        const { entity, ledger } = makeEntityWithLedger(species, 100)
        const expectedCost = rate * dt
        applyMetabolism(entity, dt, ledger)
        expect(entity.energy).toBeCloseTo(100 - expectedCost, 10)
      })
    }
  })

  describe('energy floor — no negative energy', () => {
    it('clamps transfer to available energy when cost exceeds balance', () => {
      // AC5: entity with only 0.001 energy, cost=0.05*(1/30)≈0.00167 > 0.001
      // transfer is clamped to 0.001; entity.energy becomes 0 (not negative)
      const { entity, ledger } = makeEntityWithLedger('herbivore', 0.001)
      applyMetabolism(entity, dt, ledger)
      expect(entity.energy).toBeGreaterThanOrEqual(0)
      expect(entity.energy).toBeLessThanOrEqual(0.001)
    })

    it('soil receives only the clamped amount when entity is near-empty', () => {
      // AC5: conservation still holds when clamped
      const { entity, ledger } = makeEntityWithLedger('herbivore', 0.001)
      const totalBefore = ledger.totalEnergy()
      applyMetabolism(entity, dt, ledger)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })
  })
})
