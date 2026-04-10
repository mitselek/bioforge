import { describe, it, expect } from 'vitest'
import { applyMetabolism, checkWasteDrop } from '../src/core/metabolism.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'
import { makeLedger } from '../src/core/energy.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'
import { makeDeadMatterRegistry } from '../src/core/deadMatter.js'
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

// Story 4.2 AC4+AC5 — waste buffer threshold → poop/compost dropping
// Spec §4.2: "When wasteBuffer >= POOP_THRESHOLD entity drops poop with full buffer value"
// Spec §4.3: "Decomposers produce compost instead of poop"
// Spec §2: Energy conservation. Config: poopThreshold = 10
describe('checkWasteDrop', () => {
  // poopThreshold = 10 in defaultConfig()

  function makeWasteEntity(
    species: Species,
    wasteBuffer: number,
    energy = 200,
  ): {
    entity: ReturnType<typeof makeEntity>
    ledger: ReturnType<typeof makeLedger>
    deadMatter: ReturnType<typeof makeDeadMatterRegistry>
  } {
    const rng = makeRng(42)
    const stats = cfg.species[species]
    const entity = makeEntity({
      id: entityId(5),
      species,
      position: { x: 30, y: 20 },
      orientation: 0,
      energy,
      lifespan: 900,
      maturityAge: 300,
      genome: randomGenome(rng, cfg),
      stats,
    })
    entity.wasteBuffer = wasteBuffer
    const ledger = makeLedger({ totalEnergy: energy + 1000, initialSoil: 1000 })
    ledger.register({ kind: 'entity', id: 5 }, energy)
    const deadMatter = makeDeadMatterRegistry()
    return { entity, ledger, deadMatter }
  }

  describe('threshold met — herbivore drops poop', () => {
    it('returns a poop item when wasteBuffer >= poopThreshold', () => {
      // AC1: wasteBuffer=15 >= poopThreshold=10 → poop created
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 15)
      const result = checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect(result).not.toBeNull()
      expect(result).toHaveProperty('id')
    })

    it('returned poop has energy equal to the full wasteBuffer amount', () => {
      // AC2: poop.energy === wasteBuffer (15)
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 15)
      const result = checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect(result?.energy).toBe(15)
    })

    it('poop is created at entity position', () => {
      // AC1: dead matter appears at the entity's current position
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 15)
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      const poops = [...deadMatter.poop()]
      expect(poops).toHaveLength(1)
      expect(poops[0]?.position).toEqual({ x: 30, y: 20 })
    })

    it('entity wasteBuffer is reset to 0 after drop', () => {
      // AC4: wasteBuffer cleared
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 15)
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect(entity.wasteBuffer).toBe(0)
    })

    it('entity energy decreases by wasteBuffer amount', () => {
      // AC3: energy flows from entity pool
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 15, 200)
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect(entity.energy).toBeCloseTo(200 - 15, 10)
    })

    it('ledger poop pool receives wasteBuffer amount', () => {
      // AC3: transfer via ledger
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 15)
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      const poops = [...deadMatter.poop()]
      if (poops[0] === undefined) throw new Error('poop should exist')
      expect(ledger.get({ kind: 'poop', id: poops[0].id })).toBeCloseTo(15, 10)
    })

    it('total ledger energy is conserved after poop drop', () => {
      // AC8: conservation
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 15)
      const totalBefore = ledger.totalEnergy()
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })
  })

  describe('species discrimination — decomposer drops compost not poop', () => {
    it('decomposer drops compost item (not poop)', () => {
      // AC6: decomposer → compost registry, not poop registry
      const { entity, ledger, deadMatter } = makeWasteEntity('decomposer', 15)
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect([...deadMatter.compost()]).toHaveLength(1)
      expect([...deadMatter.poop()]).toHaveLength(0)
    })

    it('returned value for decomposer has correct energy', () => {
      // AC2+AC6: compost energy === wasteBuffer
      const { entity, ledger, deadMatter } = makeWasteEntity('decomposer', 12)
      const result = checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect(result?.energy).toBe(12)
    })

    it('carnivore drops poop (not compost)', () => {
      // AC5: non-decomposers always produce poop
      const { entity, ledger, deadMatter } = makeWasteEntity('carnivore', 20)
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect([...deadMatter.poop()]).toHaveLength(1)
      expect([...deadMatter.compost()]).toHaveLength(0)
    })
  })

  describe('threshold not met — no drop', () => {
    it('returns null when wasteBuffer < poopThreshold', () => {
      // AC7: wasteBuffer=9 < threshold=10 → null, nothing happens
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 9)
      const result = checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect(result).toBeNull()
    })

    it('wasteBuffer unchanged when threshold not met', () => {
      // AC7: no side effects when below threshold
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 9)
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect(entity.wasteBuffer).toBe(9)
    })

    it('no dead matter created when threshold not met', () => {
      // AC7: registry stays empty
      const { entity, ledger, deadMatter } = makeWasteEntity('herbivore', 9)
      checkWasteDrop(entity, ledger, deadMatter, cfg)
      expect([...deadMatter.poop()]).toHaveLength(0)
      expect([...deadMatter.compost()]).toHaveLength(0)
    })
  })
})
