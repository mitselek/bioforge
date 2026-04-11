import { describe, it, expect } from 'vitest'
import { checkDeath as checkDeathBase, processReproduction } from '../src/core/lifecycle.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig, makeConfig } from '../src/core/config.js'
import { makeLedger } from '../src/core/energy.js'
import { makeDeadMatterRegistry } from '../src/core/deadMatter.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'
import type { Config } from '../src/core/config.js'

// Issue #10: checkDeathBase is used for all tests (existing + new).
// The real RED is the @ts-expect-error in makeVariabilityConfig below,
// which forces GREEN to add ageDeathVariability to SpeciesStats.

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
      const result = checkDeathBase(entity, ledger, dm, cfg)
      expect(result.died).toBe(true)
    })

    it('returns died=true when age exceeds lifespan', () => {
      // AC1: age past lifespan also triggers death
      const entity = makeHerbivore(50, 950, 900)
      const ledger = makeLedgerWith(50)
      const dm = makeDeadMatterRegistry()
      const result = checkDeathBase(entity, ledger, dm, cfg)
      expect(result.died).toBe(true)
    })

    it('returns died=true when energy <= energyEpsilon (starvation)', () => {
      // AC2: energy at epsilon threshold is considered zero — starvation death
      const entity = makeHerbivore(cfg.energyEpsilon, 10, 900)
      const ledger = makeLedgerWith(cfg.energyEpsilon)
      const dm = makeDeadMatterRegistry()
      const result = checkDeathBase(entity, ledger, dm, cfg)
      expect(result.died).toBe(true)
    })

    it('returns died=false when age < lifespan and energy > energyEpsilon', () => {
      // AC3: healthy entity survives
      const entity = makeHerbivore(50, 10, 900)
      const ledger = makeLedgerWith(50)
      const dm = makeDeadMatterRegistry()
      const result = checkDeathBase(entity, ledger, dm, cfg)
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
      const result = checkDeathBase(entity, ledger, dm, cfg)
      expect(result.corpse).not.toBeNull()
      expect(result.corpse?.energy).toBeCloseTo(75, 10)
      expect(result.corpse?.position).toEqual({ x: 20, y: 10 })
    })

    it('registers the corpse in the dead matter registry', () => {
      // AC5: corpse can be found by iterating the registry
      const entity = makeHerbivore(75, 900, 900)
      const ledger = makeLedgerWith(75)
      const dm = makeDeadMatterRegistry()
      checkDeathBase(entity, ledger, dm, cfg)
      expect([...dm.corpses()]).toHaveLength(1)
    })

    it('unregisters entity pool from ledger after death', () => {
      // AC6: entity pool no longer exists in ledger
      const entity = makeHerbivore(75, 900, 900)
      const ledger = makeLedgerWith(75)
      const dm = makeDeadMatterRegistry()
      checkDeathBase(entity, ledger, dm, cfg)
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
      checkDeathBase(entity, ledger, dm, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
    })

    it('totalEnergy is unchanged after starvation death', () => {
      // AC7: conservation holds even for near-zero energy deaths
      const entity = makeHerbivore(cfg.energyEpsilon, 10, 900)
      const ledger = makeLedgerWith(cfg.energyEpsilon)
      const dm = makeDeadMatterRegistry()
      const totalBefore = ledger.totalEnergy()
      checkDeathBase(entity, ledger, dm, cfg)
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
      const result = checkDeathBase(entity, ledger, dm, cfg2)
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
      checkDeathBase(entity, ledger, dm, cfg2)
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

// =============================================================================
// Issue #10 — Probabilistic age-death with variability window
// =============================================================================
//
// New config field: SpeciesStats.ageDeathVariability (0–1)
// New checkDeath signature: checkDeath(entity, rng, ledger, deadMatter, cfg)
//
// Death logic:
//   lower = lifespan * (1 - ageDeathVariability)
//   upper = lifespan * (1 + ageDeathVariability)
//   age <  lower         → no age-related death
//   lower <= age < upper → p = (age - lower) / (upper - lower); rng.float() < p → dies
//   age >= upper         → guaranteed death
//
// Spec §5.3. Plan: Issue #10.
//
// (*BF:Merian*)
// =============================================================================

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFESPAN = 900
const VARIABILITY = 0.2
const LOWER = LIFESPAN * (1 - VARIABILITY) // 720
const UPPER = LIFESPAN * (1 + VARIABILITY) // 1080
const MID_AGE = (LOWER + UPPER) / 2 // 900 — p=0.5

// ── Fixtures ─────────────────────────────────────────────────────────────────

// makeConfig with ageDeathVariability added to herbivore stats.
// RED: SpeciesStats does not yet have ageDeathVariability — @ts-expect-error forces GREEN to add it.
function makeVariabilityConfig(variability: number): Config {
  const base = defaultConfig()
  return makeConfig({
    species: {
      ...base.species,
      herbivore: {
        ...base.species.herbivore,
        // @ts-expect-error — ageDeathVariability not yet in SpeciesStats; remove when GREEN adds it
        ageDeathVariability: variability,
      },
    },
  })
}

function makeHerbivoreV(energy: number, age: number): ReturnType<typeof makeEntity> {
  const rng = makeRng(42)
  const entity = makeEntity({
    id: entityId(10),
    species: 'herbivore',
    position: { x: 10, y: 10 },
    orientation: 0,
    energy,
    lifespan: LIFESPAN,
    maturityAge: 300,
    genome: randomGenome(rng, defaultConfig()),
    stats: defaultConfig().species.herbivore,
  })
  entity.age = age
  return entity
}

function makeLedgerV(id: number, energy: number): ReturnType<typeof makeLedger> {
  const ledger = makeLedger({ totalEnergy: energy + 1000, initialSoil: 1000 })
  ledger.register({ kind: 'entity', id }, energy)
  return ledger
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1 — Below lower bound: entity never dies from age
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #10 AC1 — age < lower bound: no age death', () => {
  it('entity at age 719 (< lower=720) does not die', () => {
    // RED: makeVariabilityConfig @ts-expect-error fails until GREEN adds ageDeathVariability
    const cfg2 = makeVariabilityConfig(VARIABILITY)
    const entity = makeHerbivoreV(50, 719)
    const ledger = makeLedgerV(10, 50)
    const dm = makeDeadMatterRegistry()
    const result = checkDeathBase(entity, ledger, dm, cfg2)
    expect(result.died).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC2 — At/above upper bound: entity always dies
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #10 AC2 — age >= upper bound: guaranteed death', () => {
  it('entity at exactly upper=1080 always dies', () => {
    const cfg2 = makeVariabilityConfig(VARIABILITY)
    const entity = makeHerbivoreV(50, 1080)
    const ledger = makeLedgerV(10, 50)
    const dm = makeDeadMatterRegistry()
    const result = checkDeathBase(entity, ledger, dm, cfg2)
    expect(result.died).toBe(true)
  })

  it('entity at age 1200 (> upper) always dies', () => {
    const cfg2 = makeVariabilityConfig(VARIABILITY)
    const entity = makeHerbivoreV(50, 1200)
    const ledger = makeLedgerV(10, 50)
    const dm = makeDeadMatterRegistry()
    const result = checkDeathBase(entity, ledger, dm, cfg2)
    expect(result.died).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — Ramp zone statistical: ~50% die at midpoint age (1000 trials)
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #10 AC3 — ramp zone: 35–65% die at p=0.5 midpoint (1000 trials)', () => {
  it('death rate is between 35% and 65% at mid-ramp age=900', () => {
    // RED: current hard cutoff age >= lifespan=900 → 100% die today (rate=1.0 > 0.65)
    const cfg2 = makeVariabilityConfig(VARIABILITY)
    let deaths = 0
    const TRIALS = 1000
    for (let seed = 0; seed < TRIALS; seed++) {
      const entity = makeEntity({
        id: entityId(seed + 2000),
        species: 'herbivore',
        position: { x: 10, y: 10 },
        orientation: 0,
        energy: 50,
        lifespan: LIFESPAN,
        maturityAge: 300,
        genome: randomGenome(makeRng(seed), defaultConfig()),
        stats: defaultConfig().species.herbivore,
      })
      entity.age = MID_AGE
      const ledger = makeLedger({ totalEnergy: 1050, initialSoil: 1000 })
      ledger.register({ kind: 'entity', id: seed + 2000 }, 50)
      const dm = makeDeadMatterRegistry()
      const result = checkDeathBase(entity, ledger, dm, cfg2)
      if (result.died) deaths++
    }
    const rate = deaths / TRIALS
    expect(rate).toBeGreaterThan(0.35)
    expect(rate).toBeLessThan(0.65)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC4 — variability=0: behaves like old hard cutoff
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #10 AC4 — ageDeathVariability=0 behaves like hard cutoff', () => {
  it('age < lifespan → survives (variability=0)', () => {
    const cfg2 = makeVariabilityConfig(0)
    const entity = makeHerbivoreV(50, LIFESPAN - 1)
    const ledger = makeLedgerV(10, 50)
    const dm = makeDeadMatterRegistry()
    const result = checkDeathBase(entity, ledger, dm, cfg2)
    expect(result.died).toBe(false)
  })

  it('age === lifespan → dies (variability=0)', () => {
    const cfg2 = makeVariabilityConfig(0)
    const entity = makeHerbivoreV(50, LIFESPAN)
    const ledger = makeLedgerV(10, 50)
    const dm = makeDeadMatterRegistry()
    const result = checkDeathBase(entity, ledger, dm, cfg2)
    expect(result.died).toBe(true)
  })

  it('age > lifespan → dies (variability=0)', () => {
    const cfg2 = makeVariabilityConfig(0)
    const entity = makeHerbivoreV(50, LIFESPAN + 10)
    const ledger = makeLedgerV(10, 50)
    const dm = makeDeadMatterRegistry()
    const result = checkDeathBase(entity, ledger, dm, cfg2)
    expect(result.died).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC5 — Starvation death unchanged by variability
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #10 AC5 — starvation death is unaffected by ageDeathVariability', () => {
  it('energy <= epsilon → dies even when age << lower bound', () => {
    const cfg2 = makeVariabilityConfig(VARIABILITY)
    const entity = makeHerbivoreV(cfg2.energyEpsilon, 1)
    const ledger = makeLedgerV(10, cfg2.energyEpsilon)
    const dm = makeDeadMatterRegistry()
    const result = checkDeathBase(entity, ledger, dm, cfg2)
    expect(result.died).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC6 — Energy conservation on probabilistic death
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #10 AC6 — energy conservation on probabilistic age death', () => {
  it('total energy unchanged when entity dies at upper bound', () => {
    const cfg2 = makeVariabilityConfig(VARIABILITY)
    const entity = makeHerbivoreV(75, UPPER)
    const ledger = makeLedgerV(10, 75)
    const dm = makeDeadMatterRegistry()
    const totalBefore = ledger.totalEnergy()
    checkDeathBase(entity, ledger, dm, cfg2)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
  })

  it('corpse carries entity energy at guaranteed death', () => {
    const cfg2 = makeVariabilityConfig(VARIABILITY)
    const entity = makeHerbivoreV(75, UPPER)
    const ledger = makeLedgerV(10, 75)
    const dm = makeDeadMatterRegistry()
    const result = checkDeathBase(entity, ledger, dm, cfg2)
    expect(result.died).toBe(true)
    expect(result.corpse?.energy).toBeCloseTo(75, 10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC7 — Config validation: ageDeathVariability in [0, 1]
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #10 AC7 — ageDeathVariability config field is accepted', () => {
  it('makeConfig with ageDeathVariability=0 does not throw', () => {
    // RED: SpeciesStats does not yet have ageDeathVariability — @ts-expect-error above catches it
    expect(() => makeVariabilityConfig(0)).not.toThrow()
  })

  it('makeConfig with ageDeathVariability=1 does not throw', () => {
    expect(() => makeVariabilityConfig(1)).not.toThrow()
  })

  it('makeConfig with ageDeathVariability=0.5 does not throw', () => {
    expect(() => makeVariabilityConfig(0.5)).not.toThrow()
  })
})
