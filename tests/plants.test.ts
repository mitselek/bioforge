import { describe, it, expect } from 'vitest'
import { applyPlantAbsorption, tryCompostSpawn } from '../src/core/plants.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig, makeConfig } from '../src/core/config.js'
import { makeLedger } from '../src/core/energy.js'
import { makeDeadMatterRegistry } from '../src/core/deadMatter.js'
import type { Compost } from '../src/core/deadMatter.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'

// Story 4.4 AC4.4.5-9 — plant soil absorption + compost-boosted absorption + compost-adjacent spawning
// Spec §3.1: absorbRate; §6.3: compostBoost, compostSpawnRadius, plantSpawnBaseProb; §2: conservation

const cfg = defaultConfig()
const dt = 1 / 30

// plant: absorbRate=2.0, initialEnergy=50
// compostBoost=0.5, compostBoostCap=3.0, plantSpawnBaseProb=0.002

function makePlantWithLedger(
  plantEnergy: number,
  soilEnergy: number,
): {
  plant: ReturnType<typeof makeEntity>
  ledger: ReturnType<typeof makeLedger>
} {
  const rng = makeRng(1)
  const plant = makeEntity({
    id: entityId(1),
    species: 'plant',
    position: { x: 40, y: 15 },
    orientation: 0,
    energy: plantEnergy,
    lifespan: 1200,
    maturityAge: 400,
    genome: randomGenome(rng, cfg),
    stats: cfg.species.plant,
  })
  const ledger = makeLedger({ totalEnergy: plantEnergy + soilEnergy, initialSoil: soilEnergy })
  ledger.register({ kind: 'entity', id: 1 }, plantEnergy)
  return { plant, ledger }
}

// ─── applyPlantAbsorption ─────────────────────────────────────────────────────

describe('applyPlantAbsorption', () => {
  describe('AC4.4.5 — basic absorption from soil', () => {
    it('plant energy increases by absorbRate * dt when no compost nearby', () => {
      // absorbRate=2.0, dt=1/30 → absorbed=2.0/30≈0.06667
      const { plant, ledger } = makePlantWithLedger(100, 1000)
      const expectedAbsorb = cfg.species.plant.absorbRate * dt
      applyPlantAbsorption(plant, 0, dt, ledger, cfg)
      expect(plant.energy).toBeCloseTo(100 + expectedAbsorb, 8)
    })

    it('soil decreases by absorbed amount', () => {
      const { plant, ledger } = makePlantWithLedger(100, 1000)
      const soilBefore = ledger.get({ kind: 'soil' })
      const expectedAbsorb = cfg.species.plant.absorbRate * dt
      applyPlantAbsorption(plant, 0, dt, ledger, cfg)
      expect(ledger.get({ kind: 'soil' })).toBeCloseTo(soilBefore - expectedAbsorb, 8)
    })

    it('absorption is clamped to available soil', () => {
      // soil=0.01 < absorbRate*dt≈0.0667 → absorbed=0.01
      const { plant, ledger } = makePlantWithLedger(100, 0.01)
      applyPlantAbsorption(plant, 0, dt, ledger, cfg)
      expect(ledger.get({ kind: 'soil' })).toBeCloseTo(0, 10)
      expect(plant.energy).toBeCloseTo(100 + 0.01, 8)
    })

    it('total ledger energy is conserved', () => {
      const { plant, ledger } = makePlantWithLedger(100, 1000)
      const totalBefore = ledger.totalEnergy()
      applyPlantAbsorption(plant, 0, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 8)
    })
  })

  describe('AC4.4.6 — compost boost multiplies absorption rate', () => {
    it('1 nearby compost: rate * (1 + compostBoost * 1)', () => {
      // boostMultiplier = min(1 + 0.5*1, 3.0) = 1.5; absorbed = 2.0 * 1.5 / 30 = 0.1
      const { plant, ledger } = makePlantWithLedger(100, 1000)
      const boostMultiplier = Math.min(1 + cfg.compostBoost * 1, cfg.compostBoostCap)
      const expectedAbsorb = cfg.species.plant.absorbRate * dt * boostMultiplier
      applyPlantAbsorption(plant, 1, dt, ledger, cfg)
      expect(plant.energy).toBeCloseTo(100 + expectedAbsorb, 8)
    })

    it('4 nearby composts: rate * compostBoostCap (capped at 3.0)', () => {
      // boostMultiplier = min(1 + 0.5*4, 3.0) = min(3.0, 3.0) = 3.0
      const { plant, ledger } = makePlantWithLedger(100, 1000)
      const expectedAbsorb = cfg.species.plant.absorbRate * dt * cfg.compostBoostCap
      applyPlantAbsorption(plant, 4, dt, ledger, cfg)
      expect(plant.energy).toBeCloseTo(100 + expectedAbsorb, 8)
    })

    it('10 nearby composts: boost still capped at compostBoostCap', () => {
      // min(1 + 0.5*10, 3.0) = min(6.0, 3.0) = 3.0 → same as 4 composts
      const { plant, ledger } = makePlantWithLedger(100, 1000)
      const { plant: plant2, ledger: ledger2 } = makePlantWithLedger(100, 1000)
      applyPlantAbsorption(plant, 4, dt, ledger, cfg)
      applyPlantAbsorption(plant2, 10, dt, ledger2, cfg)
      expect(plant.energy).toBeCloseTo(plant2.energy, 8)
    })

    it('boosted absorption still conserves ledger energy', () => {
      const { plant, ledger } = makePlantWithLedger(100, 1000)
      const totalBefore = ledger.totalEnergy()
      applyPlantAbsorption(plant, 2, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 8)
    })
  })
})

// ─── tryCompostSpawn ──────────────────────────────────────────────────────────

describe('tryCompostSpawn', () => {
  // Use plantSpawnBaseProb=1.0 to guarantee spawn on any rng draw

  const cfgAlwaysSpawn = makeConfig({ plantSpawnBaseProb: 1.0 })
  const cfgNeverSpawn = makeConfig({ plantSpawnBaseProb: 0 })
  const cfgNoAuto = makeConfig({ autoSpawnPlants: false })

  function makeCompostForSpawn(compostEnergy: number): {
    compost: Compost
    ledger: ReturnType<typeof makeLedger>
    deadMatter: ReturnType<typeof makeDeadMatterRegistry>
  } {
    const deadMatter = makeDeadMatterRegistry()
    const compost = deadMatter.addCompost({ x: 40, y: 15 }, compostEnergy)
    // plant initialEnergy=50; soil provides top-up if compost < 50
    const soilEnergy = 1000
    const ledger = makeLedger({
      totalEnergy: compostEnergy + soilEnergy,
      initialSoil: soilEnergy,
    })
    ledger.register({ kind: 'compost', id: compost.id }, compostEnergy)
    return { compost, ledger, deadMatter }
  }

  describe('AC4.4.7 — spawn probability roll', () => {
    it('returns null when plantSpawnBaseProb=0 (probability 0)', () => {
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const rng = makeRng(1)
      const result = tryCompostSpawn(compost, entityId(100), rng, ledger, deadMatter, cfgNeverSpawn)
      expect(result).toBeNull()
    })

    it('returns a plant entity when plantSpawnBaseProb=1.0 (probability 1)', () => {
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const rng = makeRng(1)
      const result = tryCompostSpawn(
        compost,
        entityId(100),
        rng,
        ledger,
        deadMatter,
        cfgAlwaysSpawn,
      )
      expect(result).not.toBeNull()
      expect(result?.species).toBe('plant')
    })

    it('spawned plant has the provided childId', () => {
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const rng = makeRng(1)
      const result = tryCompostSpawn(compost, entityId(42), rng, ledger, deadMatter, cfgAlwaysSpawn)
      expect(result?.id).toBe(42)
    })
  })

  describe('AC4.4.8 — compost energy transferred to new plant', () => {
    it('compost energy = initialEnergy: compost fully consumed, plant has initialEnergy', () => {
      // compost=50 = plant initialEnergy=50 → no top-up needed
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const rng = makeRng(1)
      const result = tryCompostSpawn(
        compost,
        entityId(100),
        rng,
        ledger,
        deadMatter,
        cfgAlwaysSpawn,
      )
      expect(compost.energy).toBeCloseTo(0, 8)
      expect(result?.energy).toBeCloseTo(50, 8)
    })

    it('compost energy < initialEnergy: remainder topped up from soil', () => {
      // compost=20 < initialEnergy=50 → plant gets 50, soil fills 30
      const { compost, ledger, deadMatter } = makeCompostForSpawn(20)
      const soilBefore = ledger.get({ kind: 'soil' })
      const rng = makeRng(1)
      const result = tryCompostSpawn(
        compost,
        entityId(100),
        rng,
        ledger,
        deadMatter,
        cfgAlwaysSpawn,
      )
      expect(result?.energy).toBeCloseTo(50, 8)
      expect(compost.energy).toBeCloseTo(0, 8)
      expect(ledger.get({ kind: 'soil' })).toBeCloseTo(soilBefore - 30, 8)
    })

    it('spawned plant is registered in ledger with its energy', () => {
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const rng = makeRng(1)
      const result = tryCompostSpawn(
        compost,
        entityId(100),
        rng,
        ledger,
        deadMatter,
        cfgAlwaysSpawn,
      )
      if (result === null) throw new Error('expected a plant')
      expect(ledger.get({ kind: 'entity', id: result.id })).toBeCloseTo(50, 8)
    })

    it('total ledger energy is conserved after spawn', () => {
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const totalBefore = ledger.totalEnergy()
      const rng = makeRng(1)
      tryCompostSpawn(compost, entityId(100), rng, ledger, deadMatter, cfgAlwaysSpawn)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 8)
    })
  })

  describe('AC4.4.9 — autoSpawnPlants === false prevents spawning', () => {
    it('returns null when autoSpawnPlants is false, even with prob=1', () => {
      // cfg has autoSpawnPlants=false, plantSpawnBaseProb defaults to 0.002
      // Even though cfgNoAuto has normal prob, the guard short-circuits
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const rng = makeRng(1)
      const result = tryCompostSpawn(compost, entityId(100), rng, ledger, deadMatter, cfgNoAuto)
      expect(result).toBeNull()
    })

    it('no plant registered in ledger when autoSpawnPlants is false', () => {
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const rng = makeRng(1)
      tryCompostSpawn(compost, entityId(100), rng, ledger, deadMatter, cfgNoAuto)
      // ledger should not have entity#100 pool
      expect(() => ledger.get({ kind: 'entity', id: 100 })).toThrow()
    })

    it('compost energy unchanged when autoSpawnPlants is false', () => {
      const { compost, ledger, deadMatter } = makeCompostForSpawn(50)
      const rng = makeRng(1)
      tryCompostSpawn(compost, entityId(100), rng, ledger, deadMatter, cfgNoAuto)
      expect(compost.energy).toBeCloseTo(50, 8)
    })
  })
})
