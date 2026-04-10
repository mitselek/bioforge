import { describe, it, expect } from 'vitest'
import { checkDeath, processReproduction } from '../src/core/lifecycle.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig, makeConfig } from '../src/core/config.js'
import { makeLedger } from '../src/core/energy.js'
import { makeDeadMatterRegistry } from '../src/core/deadMatter.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'

// Story 4.3 AC1 — death conditions and corpse creation
// Spec §5.3 (death conditions), §4.1 (corpse creation), §2.5 (ENERGY_EPSILON), §2 (conservation)

const cfg = defaultConfig()

function makeHerbivore(
  energy: number,
  age: number,
  lifespan: number,
): ReturnType<typeof makeEntity> {
  const rng = makeRng(1)
  const stats = cfg.species.herbivore
  const entity = makeEntity({
    id: entityId(1),
    species: 'herbivore',
    position: { x: 20, y: 10 },
    orientation: 0,
    energy,
    lifespan,
    maturityAge: 300,
    genome: randomGenome(rng, cfg),
    stats,
  })
  entity.age = age
  return entity
}

function makeLedgerWith(energy: number): ReturnType<typeof makeLedger> {
  const ledger = makeLedger({ totalEnergy: energy + 1000, initialSoil: 1000 })
  ledger.register({ kind: 'entity', id: 1 }, energy)
  return ledger
}

describe('checkDeath', () => {
  describe('death conditions', () => {
    it('returns died=true when age >= lifespan (old age)', () => {
      // AC1: age equals lifespan — entity should die
      const entity = makeHerbivore(50, 900, 900)
      const ledger = makeLedgerWith(50)
      const dm = makeDeadMatterRegistry()
      const result = checkDeath(entity, ledger, dm, cfg)
      expect(result.died).toBe(true)
    })

    it('returns died=true when age exceeds lifespan', () => {
      // AC1: age past lifespan also triggers death
      const entity = makeHerbivore(50, 950, 900)
      const ledger = makeLedgerWith(50)
      const dm = makeDeadMatterRegistry()
      const result = checkDeath(entity, ledger, dm, cfg)
      expect(result.died).toBe(true)
    })

    it('returns died=true when energy <= energyEpsilon (starvation)', () => {
      // AC2: energy at epsilon threshold is considered zero — starvation death
      const entity = makeHerbivore(cfg.energyEpsilon, 10, 900)
      const ledger = makeLedgerWith(cfg.energyEpsilon)
      const dm = makeDeadMatterRegistry()
      const result = checkDeath(entity, ledger, dm, cfg)
      expect(result.died).toBe(true)
    })

    it('returns died=false when age < lifespan and energy > energyEpsilon', () => {
      // AC3: healthy entity survives
      const entity = makeHerbivore(50, 10, 900)
      const ledger = makeLedgerWith(50)
      const dm = makeDeadMatterRegistry()
      const result = checkDeath(entity, ledger, dm, cfg)
      expect(result.died).toBe(false)
      expect(result.corpse).toBeNull()
    })
  })

  describe('corpse creation on death', () => {
    it('creates a corpse with the entity energy at death position', () => {
      // AC4: corpse appears at entity position with entity's remaining energy
      const entity = makeHerbivore(75, 900, 900)
      const ledger = makeLedgerWith(75)
      const dm = makeDeadMatterRegistry()
      const result = checkDeath(entity, ledger, dm, cfg)
      expect(result.corpse).not.toBeNull()
      expect(result.corpse?.energy).toBeCloseTo(75, 10)
      expect(result.corpse?.position).toEqual({ x: 20, y: 10 })
    })

    it('registers the corpse in the dead matter registry', () => {
      // AC5: corpse can be found by iterating the registry
      const entity = makeHerbivore(75, 900, 900)
      const ledger = makeLedgerWith(75)
      const dm = makeDeadMatterRegistry()
      checkDeath(entity, ledger, dm, cfg)
      expect([...dm.corpses()]).toHaveLength(1)
    })

    it('unregisters entity pool from ledger after death', () => {
      // AC6: entity pool no longer exists in ledger
      const entity = makeHerbivore(75, 900, 900)
      const ledger = makeLedgerWith(75)
      const dm = makeDeadMatterRegistry()
      checkDeath(entity, ledger, dm, cfg)
      expect(() => ledger.get({ kind: 'entity', id: 1 })).toThrow()
    })
  })

  describe('energy conservation', () => {
    it('totalEnergy is unchanged after old-age death', () => {
      // AC7: energy moves from entity pool to corpse pool, total unchanged
      const entity = makeHerbivore(75, 900, 900)
      const ledger = makeLedgerWith(75)
      const dm = makeDeadMatterRegistry()
      const totalBefore = ledger.totalEnergy()
      checkDeath(entity, ledger, dm, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })

    it('totalEnergy is unchanged after starvation death', () => {
      // AC7: conservation holds even for near-zero energy deaths
      const entity = makeHerbivore(cfg.energyEpsilon, 10, 900)
      const ledger = makeLedgerWith(cfg.energyEpsilon)
      const dm = makeDeadMatterRegistry()
      const totalBefore = ledger.totalEnergy()
      checkDeath(entity, ledger, dm, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })
  })

  describe('zero-energy elision', () => {
    it('returns null corpse when entity had no energy at death', () => {
      // AC8: zero-energy corpse is elided (spec §4.1)
      const cfg2 = makeConfig({ energyEpsilon: 0 })
      const entity = makeHerbivore(0, 900, 900)
      const ledger = makeLedger({ totalEnergy: 1000, initialSoil: 1000 })
      ledger.register({ kind: 'entity', id: 1 }, 0)
      const dm = makeDeadMatterRegistry()
      const result = checkDeath(entity, ledger, dm, cfg2)
      expect(result.died).toBe(true)
      expect(result.corpse).toBeNull()
    })

    it('adds no entry to dead matter registry when energy was zero', () => {
      // AC8: registry stays empty for zero-energy death
      const cfg2 = makeConfig({ energyEpsilon: 0 })
      const entity = makeHerbivore(0, 900, 900)
      const ledger = makeLedger({ totalEnergy: 1000, initialSoil: 1000 })
      ledger.register({ kind: 'entity', id: 1 }, 0)
      const dm = makeDeadMatterRegistry()
      checkDeath(entity, ledger, dm, cfg2)
      expect([...dm.corpses()]).toHaveLength(0)
    })
  })
})

// Story 4.3 AC2 — reproduction
// Spec §6.1 (energy split), §6.2 (genome mutation), §6.3 (stats mutation), §8, §2 (conservation)

const CHILD_ID = entityId(99)
const CURRENT_TICK = 500

function makeReproducingParent(energy: number): {
  entity: ReturnType<typeof makeEntity>
  ledger: ReturnType<typeof makeLedger>
} {
  const rng = makeRng(1)
  const stats = cfg.species.herbivore
  const entity = makeEntity({
    id: entityId(1),
    species: 'herbivore',
    position: { x: 30, y: 12 },
    orientation: 0,
    energy,
    lifespan: 900,
    maturityAge: 300,
    genome: randomGenome(rng, cfg),
    stats,
  })
  entity.age = 350 // mature
  entity.reproRequested = true
  const ledger = makeLedger({ totalEnergy: energy + 1000, initialSoil: 1000 })
  ledger.register({ kind: 'entity', id: 1 }, energy)
  return { entity, ledger }
}

describe('processReproduction', () => {
  describe('no-op when not requested', () => {
    it('returns null when reproRequested is false', () => {
      // AC10: no child if flag not set
      const { entity, ledger } = makeReproducingParent(200)
      entity.reproRequested = false
      const rng = makeRng(7)
      const result = processReproduction(
        entity,
        rng,
        ledger,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      expect(result).toBeNull()
    })

    it('does not alter parent state when not requested', () => {
      // AC10: energy, lastReproTick unchanged
      const { entity, ledger } = makeReproducingParent(200)
      entity.reproRequested = false
      const energyBefore = entity.energy
      const reproTickBefore = entity.lastReproTick
      const rng = makeRng(7)
      processReproduction(entity, rng, ledger, cfg, CURRENT_TICK, CHILD_ID, cfg.worldW, cfg.worldH)
      expect(entity.energy).toBe(energyBefore)
      expect(entity.lastReproTick).toBe(reproTickBefore)
    })
  })

  describe('child creation', () => {
    it('returns a child entity when reproRequested is true', () => {
      // AC1: a child is produced
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      const child = processReproduction(
        entity,
        rng,
        ledger,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      expect(child).not.toBeNull()
    })

    it('child starts with age=0 and reproRequested=false', () => {
      // AC7: child initial state
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      const child = processReproduction(
        entity,
        rng,
        ledger,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      expect(child?.age).toBe(0)
      expect(child?.reproRequested).toBe(false)
    })

    it('child position is near parent position (within 1 unit each axis)', () => {
      // AC4.3.3 AC2: offset is small — child spawns close to parent, not far away
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      const child = processReproduction(
        entity,
        rng,
        ledger,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      // Use torus-aware delta: child may have wrapped, so check shortest distance
      if (child === null) throw new Error('child should not be null')
      const dx = Math.abs(((child.position.x - 30 + cfg.worldW / 2) % cfg.worldW) - cfg.worldW / 2)
      const dy = Math.abs(((child.position.y - 12 + cfg.worldH / 2) % cfg.worldH) - cfg.worldH / 2)
      expect(dx).toBeLessThanOrEqual(1)
      expect(dy).toBeLessThanOrEqual(1)
    })

    it('child has the assigned id', () => {
      // AC1: child uses the provided childId
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      const child = processReproduction(
        entity,
        rng,
        ledger,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      expect(child?.id).toBe(CHILD_ID)
    })
  })

  describe('energy split', () => {
    it('child receives parent.energy * reproCostFraction', () => {
      // AC2: herbivore reproCostFraction=0.5, parent energy=200 → child gets 100
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      const child = processReproduction(
        entity,
        rng,
        ledger,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      const expectedChildEnergy = 200 * cfg.species.herbivore.reproCostFraction
      expect(child?.energy).toBeCloseTo(expectedChildEnergy, 10)
    })

    it('parent retains energy after giving reproCostFraction to child', () => {
      // AC3: parent keeps (1 - reproCostFraction) fraction
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      processReproduction(entity, rng, ledger, cfg, CURRENT_TICK, CHILD_ID, cfg.worldW, cfg.worldH)
      const expectedParentEnergy = 200 * (1 - cfg.species.herbivore.reproCostFraction)
      expect(entity.energy).toBeCloseTo(expectedParentEnergy, 10)
    })

    it('ledger entity pool reflects parent energy after split', () => {
      // AC3 via ledger: ledger tracks parent's reduced balance
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      processReproduction(entity, rng, ledger, cfg, CURRENT_TICK, CHILD_ID, cfg.worldW, cfg.worldH)
      expect(ledger.get({ kind: 'entity', id: 1 })).toBeCloseTo(
        200 * (1 - cfg.species.herbivore.reproCostFraction),
        10,
      )
    })
  })

  describe('parent state after reproduction', () => {
    it('resets reproRequested to false', () => {
      // AC8: flag cleared so VM must set it again next tick
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      processReproduction(entity, rng, ledger, cfg, CURRENT_TICK, CHILD_ID, cfg.worldW, cfg.worldH)
      expect(entity.reproRequested).toBe(false)
    })

    it('sets lastReproTick to currentTick', () => {
      // AC8: cooldown anchor updated
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      processReproduction(entity, rng, ledger, cfg, CURRENT_TICK, CHILD_ID, cfg.worldW, cfg.worldH)
      expect(entity.lastReproTick).toBe(CURRENT_TICK)
    })
  })

  describe('energy conservation', () => {
    it('totalEnergy is unchanged after reproduction', () => {
      // AC9: energy split is internal, no energy created or destroyed
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      const totalBefore = ledger.totalEnergy()
      processReproduction(entity, rng, ledger, cfg, CURRENT_TICK, CHILD_ID, cfg.worldW, cfg.worldH)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })
  })

  describe('determinism', () => {
    it('produces identical child genome for the same rng seed', () => {
      // AC11: same seed → same tape
      const { entity: e1, ledger: l1 } = makeReproducingParent(200)
      const { entity: e2, ledger: l2 } = makeReproducingParent(200)
      const child1 = processReproduction(
        e1,
        makeRng(7),
        l1,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      const child2 = processReproduction(
        e2,
        makeRng(7),
        l2,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      expect(child1?.genome.tape).toEqual(child2?.genome.tape)
    })
  })

  // Story 4.3 AC4.3.3 — child position offset
  // Spec §6.1 ("small random offset"), §1 (torus wrap)
  describe('child position offset', () => {
    it('child position is not exactly equal to parent position', () => {
      // AC1: offset must be applied — child is not at the exact same coordinates
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      const child = processReproduction(
        entity,
        rng,
        ledger,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      const sameX = child?.position.x === entity.position.x
      const sameY = child?.position.y === entity.position.y
      expect(sameX && sameY).toBe(false)
    })

    it('child position is torus-wrapped within world bounds', () => {
      // AC4: position.x in [0, worldW), position.y in [0, worldH)
      const { entity, ledger } = makeReproducingParent(200)
      const rng = makeRng(7)
      const child = processReproduction(
        entity,
        rng,
        ledger,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      expect(child?.position.x).toBeGreaterThanOrEqual(0)
      expect(child?.position.x).toBeLessThan(cfg.worldW)
      expect(child?.position.y).toBeGreaterThanOrEqual(0)
      expect(child?.position.y).toBeLessThan(cfg.worldH)
    })

    it('child position is deterministic for the same rng seed', () => {
      // AC3: same seed → same offset → same child position
      const { entity: e1, ledger: l1 } = makeReproducingParent(200)
      const { entity: e2, ledger: l2 } = makeReproducingParent(200)
      const child1 = processReproduction(
        e1,
        makeRng(7),
        l1,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      const child2 = processReproduction(
        e2,
        makeRng(7),
        l2,
        cfg,
        CURRENT_TICK,
        CHILD_ID,
        cfg.worldW,
        cfg.worldH,
      )
      expect(child1?.position.x).toBe(child2?.position.x)
      expect(child1?.position.y).toBe(child2?.position.y)
    })
  })
})
