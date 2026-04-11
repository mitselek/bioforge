import { describe, it, expect } from 'vitest'
import { applyEating } from '../src/core/eating.js'
import { applyDecomposerEating, applyCorpseDecay } from '../src/core/decomposition.js'
import { applyPlantAbsorption } from '../src/core/plants.js'
import { applyMetabolism, checkWasteDrop } from '../src/core/metabolism.js'
import { applyMovementCost } from '../src/core/physics.js'
import { checkDeath } from '../src/core/lifecycle.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'
import { makeLedger } from '../src/core/energy.js'
import { makeDeadMatterRegistry } from '../src/core/deadMatter.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'

// Conservation integration tests — Story 4.x AC4.4.10, AC4.2.6, AC4.5.3-5
// Spec §2: "Total system energy is constant"
// Spec §2.5: ENERGY_EPSILON = 1e-6

const cfg = defaultConfig()
const dt = 1 / 30

function makeHerbivore(id: number, energy: number): ReturnType<typeof makeEntity> {
  const rng = makeRng(id)
  return makeEntity({
    id: entityId(id),
    species: 'herbivore',
    position: { x: 40, y: 15 },
    orientation: 0,
    energy,
    lifespan: 900,
    maturityAge: 300,
    genome: randomGenome(rng, cfg),
    stats: cfg.species.herbivore,
  })
}

function makeCarnivore(id: number, energy: number): ReturnType<typeof makeEntity> {
  const rng = makeRng(id)
  return makeEntity({
    id: entityId(id),
    species: 'carnivore',
    position: { x: 40, y: 15 },
    orientation: 0,
    energy,
    lifespan: 700,
    maturityAge: 200,
    genome: randomGenome(rng, cfg),
    stats: cfg.species.carnivore,
  })
}

function makeDecomposer(id: number, energy: number): ReturnType<typeof makeEntity> {
  const rng = makeRng(id)
  return makeEntity({
    id: entityId(id),
    species: 'decomposer',
    position: { x: 40, y: 15 },
    orientation: 0,
    energy,
    lifespan: 600,
    maturityAge: 150,
    genome: randomGenome(rng, cfg),
    stats: cfg.species.decomposer,
  })
}

function makePlant(id: number, energy: number): ReturnType<typeof makeEntity> {
  const rng = makeRng(id)
  return makeEntity({
    id: entityId(id),
    species: 'plant',
    position: { x: 40, y: 15 },
    orientation: 0,
    energy,
    lifespan: 1200,
    maturityAge: 400,
    genome: randomGenome(rng, cfg),
    stats: cfg.species.plant,
  })
}

// ─── AC4.4.10 — multi-operation sequence conservation ─────────────────────────

describe('AC4.4.10 — multi-operation sequence energy conservation', () => {
  it('metabolism + eating + corpse decay + decomposer eating + plant absorption conserves energy', () => {
    // Setup: herbivore eats plant → herbivore metabolizes → herbivore dies → corpse decays
    //        → decomposer eats corpse → plant absorbs soil
    // All tracked in one ledger; total must be unchanged throughout.
    // dyingHerb starts at energyEpsilon — checkDeath will trigger immediately and be ledger-consistent.

    const herb = makeHerbivore(1, 100)
    const plant = makePlant(2, 50)
    const decomp = makeDecomposer(3, 80)
    const plantB = makePlant(4, 60)
    // dyingHerb has small positive energy (above zero, at the starvation threshold) so checkDeath
    // will create a corpse with that energy — exercising the corpse→decomposer eating path.
    const dyingEnergy = cfg.energyEpsilon
    const dyingHerb = makeHerbivore(5, dyingEnergy)
    // Override age to trigger old-age death instead of starvation, ensuring energy > 0 for corpse
    dyingHerb.age = dyingHerb.lifespan

    const soilEnergy = 500
    const corpseEnergy = 5 // use a separate entity with positive energy for corpse path
    const totalE = 100 + 50 + 80 + 60 + corpseEnergy + soilEnergy
    const ledger = makeLedger({ totalEnergy: totalE, initialSoil: soilEnergy })
    ledger.register({ kind: 'entity', id: 1 }, 100)
    ledger.register({ kind: 'entity', id: 2 }, 50)
    ledger.register({ kind: 'entity', id: 3 }, 80)
    ledger.register({ kind: 'entity', id: 4 }, 60)
    // Give dying herb corpseEnergy so corpse is non-null
    dyingHerb.energy = corpseEnergy
    ledger.register({ kind: 'entity', id: 5 }, corpseEnergy)

    const deadMatter = makeDeadMatterRegistry()

    const totalBefore = ledger.totalEnergy()

    // Step 1: herbivore eats plant
    applyEating(herb, plant, dt, ledger, cfg)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

    // Step 2: herbivore metabolizes
    applyMetabolism(herb, dt, ledger)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

    // Step 3: plant metabolizes (age++)
    applyMetabolism(plant, dt, ledger)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

    // Step 4: dying herbivore triggers death — entity.energy === energyEpsilon <= energyEpsilon
    const { died, corpse } = checkDeath(dyingHerb, makeRng(1), ledger, deadMatter, cfg)
    expect(died).toBe(true)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

    // Step 5: corpse decays one tick.
    // checkDeath already registered the corpse pool and transferred energy — no extra register needed.
    if (corpse !== null) {
      applyCorpseDecay(corpse, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

      // Step 6: decomposer eats corpse
      applyDecomposerEating(decomp, corpse, { kind: 'corpse', id: corpse.id }, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)
    }

    // Step 7: plant absorbs soil
    applyPlantAbsorption(plantB, 0, dt, ledger, cfg)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

    // Final assertion using ledger's built-in drift check
    ledger.assertEnergyConserved()
  })
})

// ─── AC4.2.6 — metabolism + waste + movement cost conservation ────────────────

describe('AC4.2.6 — metabolism + waste drop + movement cost conservation', () => {
  it('sequence of metabolism, waste drop, movement cost preserves total energy', () => {
    const herb = makeHerbivore(10, 200)
    const ledger = makeLedger({ totalEnergy: 200 + 1000, initialSoil: 1000 })
    ledger.register({ kind: 'entity', id: 10 }, 200)

    const totalBefore = ledger.totalEnergy()

    // Several ticks of metabolism to build up wasteBuffer
    const deadMatter = makeDeadMatterRegistry()
    for (let i = 0; i < 5; i++) {
      herb.velocity = { x: 0.5, y: 0 }
      applyMovementCost(herb, dt, ledger)
      applyMetabolism(herb, dt, ledger)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)
    }

    // Manually set wasteBuffer above threshold to trigger drop
    herb.wasteBuffer = cfg.poopThreshold + 1

    const result = checkWasteDrop(herb, ledger, deadMatter, cfg)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

    if (result !== null) {
      const poolKind = 'position' in result && 'id' in result ? result : null
      void poolKind // type narrowing not needed — conservation is the assertion
    }

    ledger.assertEnergyConserved()
  })

  it('10 ticks of metabolism alone conserves energy', () => {
    const herb = makeHerbivore(11, 100)
    const ledger = makeLedger({ totalEnergy: 100 + 1000, initialSoil: 1000 })
    ledger.register({ kind: 'entity', id: 11 }, 100)
    const totalBefore = ledger.totalEnergy()

    for (let i = 0; i < 10; i++) {
      applyMetabolism(herb, dt, ledger)
    }
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)
    ledger.assertEnergyConserved()
  })
})

// ─── AC4.5.3 — zero-energy prey flagged after eating ─────────────────────────

describe('AC4.5.3 — prey with zero energy is flagged', () => {
  it('prey energy reaches zero or near-zero after being fully consumed', () => {
    // carnivore eatRate=10000 effectively consumes all prey in one tick
    const carn = makeCarnivore(20, 200)
    const herb = makeHerbivore(21, 0.01) // tiny prey energy
    const ledger = makeLedger({ totalEnergy: 200 + 0.01 + 500, initialSoil: 500 })
    ledger.register({ kind: 'entity', id: 20 }, 200)
    ledger.register({ kind: 'entity', id: 21 }, 0.01)

    applyEating(carn, herb, dt, ledger, cfg)

    // prey should be at zero (fully consumed)
    expect(herb.energy).toBeCloseTo(0, 6)

    // and checkDeath should flag it
    const deadMatter = makeDeadMatterRegistry()
    const { died } = checkDeath(herb, makeRng(1), ledger, deadMatter, cfg)
    expect(died).toBe(true)

    expect(ledger.totalEnergy()).toBeCloseTo(200 + 0.01 + 500, 6)
  })
})

// ─── AC4.5.4 — eating clamps to available prey energy ────────────────────────

describe('AC4.5.4 — applyEating clamps eaten to available prey energy', () => {
  it('carnivore with eatRate*dt > prey.energy: eaten = prey.energy exactly', () => {
    // carnivore eatRate=10000, dt=1/30 → eatRate*dt≈333; prey=5 → eaten=5
    const carn = makeCarnivore(30, 200)
    const herb = makeHerbivore(31, 5)
    const ledger = makeLedger({ totalEnergy: 200 + 5 + 500, initialSoil: 500 })
    ledger.register({ kind: 'entity', id: 30 }, 200)
    ledger.register({ kind: 'entity', id: 31 }, 5)

    applyEating(carn, herb, dt, ledger, cfg)

    expect(herb.energy).toBeCloseTo(0, 8)
    expect(carn.energy).toBeCloseTo(200 + 5, 8)
    expect(ledger.totalEnergy()).toBeCloseTo(200 + 5 + 500, 6)
    ledger.assertEnergyConserved()
  })
})

// ─── AC4.5.5 — multiple sequential eats preserve conservation ─────────────────

describe('AC4.5.5 — multiple sequential eats on same prey conserve energy', () => {
  it('two predators eating same herbivore sequentially: no energy leaks', () => {
    const carn1 = makeCarnivore(40, 200)
    const carn2 = makeCarnivore(41, 200)
    const herb = makeHerbivore(42, 100)
    const totalE = 200 + 200 + 100 + 500
    const ledger = makeLedger({ totalEnergy: totalE, initialSoil: 500 })
    ledger.register({ kind: 'entity', id: 40 }, 200)
    ledger.register({ kind: 'entity', id: 41 }, 200)
    ledger.register({ kind: 'entity', id: 42 }, 100)

    const totalBefore = ledger.totalEnergy()

    // First predator eats
    applyEating(carn1, herb, dt, ledger, cfg)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

    // Second predator eats whatever remains
    applyEating(carn2, herb, dt, ledger, cfg)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)

    // Herb energy is non-negative
    expect(herb.energy).toBeGreaterThanOrEqual(0)

    ledger.assertEnergyConserved()
  })

  it('10 predators eating same herbivore: conservation holds throughout', () => {
    const herb = makeHerbivore(50, 50)
    const totalE = 50 + 10 * 100 + 500
    const ledger = makeLedger({ totalEnergy: totalE, initialSoil: 500 })
    ledger.register({ kind: 'entity', id: 50 }, 50)

    const predators = Array.from({ length: 10 }, (_, i) => {
      const c = makeCarnivore(51 + i, 100)
      ledger.register({ kind: 'entity', id: 51 + i }, 100)
      return c
    })

    const totalBefore = ledger.totalEnergy()

    for (const pred of predators) {
      applyEating(pred, herb, dt, ledger, cfg)
      expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 6)
    }

    expect(herb.energy).toBeGreaterThanOrEqual(0)
    ledger.assertEnergyConserved()
  })
})
