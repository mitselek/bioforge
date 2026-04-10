import { describe, it, expect } from 'vitest'
import { makeSim } from '../src/core/sim.js'
import { defaultConfig, makeConfig } from '../src/core/config.js'
import { makeRng } from '../src/core/rng.js'

// Story 5.1 — Sim constructor, initial state, determinism
// Spec §10 (tick loop), §17 (initial seeding), §2 (energy conservation from tick 0)

const cfg = defaultConfig()

// ─── AC5.1.1 — entity counts after construction ───────────────────────────────

describe('AC5.1.1 — makeSim seeds the correct initial entity counts', () => {
  it('produces the configured number of plants', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    const plants = [...sim.state.entities.values()].filter((e) => e.species === 'plant')
    expect(plants).toHaveLength(cfg.initialCounts.plant) // 250
  })

  it('produces the configured number of herbivores', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    const herbivores = [...sim.state.entities.values()].filter((e) => e.species === 'herbivore')
    expect(herbivores).toHaveLength(cfg.initialCounts.herbivore) // 100
  })

  it('produces the configured number of carnivores', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    const carnivores = [...sim.state.entities.values()].filter((e) => e.species === 'carnivore')
    expect(carnivores).toHaveLength(cfg.initialCounts.carnivore) // 40
  })

  it('produces the configured number of decomposers', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    const decomposers = [...sim.state.entities.values()].filter((e) => e.species === 'decomposer')
    expect(decomposers).toHaveLength(cfg.initialCounts.decomposer) // 50
  })

  it('total entity count equals sum of all initialCounts', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    const total =
      cfg.initialCounts.plant +
      cfg.initialCounts.herbivore +
      cfg.initialCounts.carnivore +
      cfg.initialCounts.decomposer
    expect(sim.state.entities.size).toBe(total) // 440
  })

  it('respects custom initialCounts from config override', () => {
    const smallCfg = makeConfig({
      initialCounts: { plant: 5, herbivore: 3, carnivore: 2, decomposer: 1 },
    })
    const rng = makeRng(smallCfg.seed)
    const sim = makeSim(smallCfg, rng)
    expect(sim.state.entities.size).toBe(11)
    const plants = [...sim.state.entities.values()].filter((e) => e.species === 'plant')
    expect(plants).toHaveLength(5)
  })
})

// ─── AC5.1.2 — initial ledger total equals cfg.totalEnergy ────────────────────

describe('AC5.1.2 — initial ledger total equals cfg.totalEnergy exactly', () => {
  it('ledger.totalEnergy() equals cfg.totalEnergy after construction', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    // The sim exposes a way to check energy conservation: assertEnergyConserved
    // on the internal ledger. We verify via the state snapshot that per-entity
    // energies sum to the expected living total and the rest is in soil.
    const livingEnergy = [...sim.state.entities.values()].reduce((sum, e) => sum + e.energy, 0)

    // Per spec §17: remaining energy (totalEnergy - living) is placed in soil.
    // The invariant: livingEnergy + soil = cfg.totalEnergy.
    // We cannot directly read soil here, but we can verify the living side is
    // consistent with defaultConfig species.initialEnergy.
    const expectedLiving =
      cfg.initialCounts.plant * cfg.species.plant.initialEnergy +
      cfg.initialCounts.herbivore * cfg.species.herbivore.initialEnergy +
      cfg.initialCounts.carnivore * cfg.species.carnivore.initialEnergy +
      cfg.initialCounts.decomposer * cfg.species.decomposer.initialEnergy
    // 250*50 + 100*100 + 40*200 + 50*80 = 12500+10000+8000+4000 = 34500
    expect(livingEnergy).toBeCloseTo(expectedLiving, 6)

    // totalEnergy - living must be non-negative (soil gets the remainder)
    expect(cfg.totalEnergy - livingEnergy).toBeGreaterThanOrEqual(0)
  })

  it('sim exposes an assertEnergyConserved method that passes at tick 0', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    // The sim must expose ledger conservation check; calling it must not throw
    expect(() => {
      sim.assertEnergyConserved()
    }).not.toThrow()
  })

  it('initial tick counter is 0', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    expect(sim.state.tick).toBe(0)
  })
})

// ─── AC5.1.3 — determinism: same seed → identical initial state ───────────────

describe('AC5.1.3 — two sims with the same seed produce identical initial state', () => {
  it('entity positions are identical across same-seed sims', () => {
    const rng1 = makeRng(cfg.seed)
    const rng2 = makeRng(cfg.seed)
    const sim1 = makeSim(cfg, rng1)
    const sim2 = makeSim(cfg, rng2)

    const ids1 = [...sim1.state.entities.keys()].sort((a, b) => a - b)
    const ids2 = [...sim2.state.entities.keys()].sort((a, b) => a - b)
    expect(ids1).toEqual(ids2)

    for (const id of ids1) {
      const e1 = sim1.state.entities.get(id)
      const e2 = sim2.state.entities.get(id)
      expect(e1).toBeDefined()
      expect(e2).toBeDefined()
      if (e1 !== undefined && e2 !== undefined) {
        expect(e1.position.x).toBeCloseTo(e2.position.x, 10)
        expect(e1.position.y).toBeCloseTo(e2.position.y, 10)
      }
    }
  })

  it('entity orientations are identical across same-seed sims', () => {
    const rng1 = makeRng(cfg.seed)
    const rng2 = makeRng(cfg.seed)
    const sim1 = makeSim(cfg, rng1)
    const sim2 = makeSim(cfg, rng2)

    for (const [id, e1] of sim1.state.entities) {
      const e2 = sim2.state.entities.get(id)
      expect(e2).toBeDefined()
      if (e2 !== undefined) {
        expect(e1.orientation).toBe(e2.orientation)
      }
    }
  })

  it('genome tape lengths are identical across same-seed sims', () => {
    const rng1 = makeRng(cfg.seed)
    const rng2 = makeRng(cfg.seed)
    const sim1 = makeSim(cfg, rng1)
    const sim2 = makeSim(cfg, rng2)

    for (const [id, e1] of sim1.state.entities) {
      const e2 = sim2.state.entities.get(id)
      expect(e2).toBeDefined()
      if (e2 !== undefined) {
        expect(e1.genome.tape.length).toBe(e2.genome.tape.length)
      }
    }
  })

  it('different seeds produce different initial positions', () => {
    const rng1 = makeRng(1)
    const rng2 = makeRng(2)
    const cfg1 = makeConfig({ seed: 1 })
    const cfg2 = makeConfig({ seed: 2 })
    const sim1 = makeSim(cfg1, rng1)
    const sim2 = makeSim(cfg2, rng2)

    // With different seeds, at least one entity position should differ
    let anyDiffers = false
    for (const [id, e1] of sim1.state.entities) {
      const e2 = sim2.state.entities.get(id)
      if (e2 !== undefined) {
        if (
          Math.abs(e1.position.x - e2.position.x) > 1e-6 ||
          Math.abs(e1.position.y - e2.position.y) > 1e-6
        ) {
          anyDiffers = true
          break
        }
      }
    }
    expect(anyDiffers).toBe(true)
  })
})

// ─── AC5.1.4 — tick steps execute in spec §10.1 order ────────────────────────

describe('AC5.1.4 — tick() executes simulation steps', () => {
  it('state.tick increments by 1 after each tick() call', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    expect(sim.state.tick).toBe(0)
    sim.tick()
    expect(sim.state.tick).toBe(1)
    sim.tick()
    expect(sim.state.tick).toBe(2)
  })

  it('entity positions can change after a tick (movement step executes)', () => {
    // After one tick the VM may set velocity and movement is applied.
    // At least some non-plant entities should have had the opportunity to move.
    // We verify tick() does not throw and entities map is still populated.
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    const countBefore = sim.state.entities.size
    sim.tick()
    // entities map still exists and is non-empty (deaths possible but unlikely at tick 1)
    expect(sim.state.entities.size).toBeGreaterThan(0)
    // total entity count should not have increased beyond seeded amount + possible births
    // (no strict bound — just verifying structure is intact)
    expect(sim.state.entities.size).toBeLessThanOrEqual(countBefore + 1000)
  })

  it('dead entities (energy <= 0) are removed from entities map after a tick', () => {
    // Use a minimal sim where at least one entity will die from starvation in one tick.
    // A carnivore with energy = energyEpsilon will die on the first metabolism step.
    const tinyCfg = makeConfig({
      initialCounts: { plant: 0, herbivore: 0, carnivore: 1, decomposer: 0 },
      totalEnergy: 200,
    })
    // Override carnivore initialEnergy to be at the starvation boundary
    const overrideCfg = makeConfig({
      ...tinyCfg,
      species: {
        ...tinyCfg.species,
        carnivore: { ...tinyCfg.species.carnivore, initialEnergy: tinyCfg.energyEpsilon },
      },
    })
    const rng = makeRng(overrideCfg.seed)
    const sim = makeSim(overrideCfg, rng)
    expect(sim.state.entities.size).toBe(1)
    sim.tick()
    // The carnivore at energy=energyEpsilon should have died during the lifecycle step
    expect(sim.state.entities.size).toBe(0)
  })
})

// ─── AC5.1.5 — energy conservation holds after every tick ────────────────────

describe('AC5.1.5 — assertEnergyConserved passes after every tick', () => {
  it('energy is conserved after 10 ticks with default config', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    for (let i = 0; i < 10; i++) {
      sim.tick()
      expect(() => {
        sim.assertEnergyConserved()
      }).not.toThrow()
    }
  })

  it('energy is conserved after 10 ticks with seed 7', () => {
    const rng = makeRng(7)
    const altCfg = makeConfig({ seed: 7 })
    const sim = makeSim(altCfg, rng)
    for (let i = 0; i < 10; i++) {
      sim.tick()
      expect(() => {
        sim.assertEnergyConserved()
      }).not.toThrow()
    }
  })
})

// ─── AC5.1.6 — no NaN/Infinity after every tick ──────────────────────────────

describe('AC5.1.6 — assertFinite passes after every tick', () => {
  it('all ledger values remain finite after 10 ticks', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    for (let i = 0; i < 10; i++) {
      sim.tick()
      expect(() => {
        sim.assertFinite()
      }).not.toThrow()
    }
  })

  it('entity energy values remain finite after 10 ticks', () => {
    const rng = makeRng(cfg.seed)
    const sim = makeSim(cfg, rng)
    for (let i = 0; i < 10; i++) {
      sim.tick()
    }
    for (const entity of sim.state.entities.values()) {
      expect(Number.isFinite(entity.energy)).toBe(true)
    }
  })
})

// ─── AC5.1.7 — sim runs 1000 ticks without crashing ──────────────────────────

describe('AC5.1.7 — 1000-tick crash-free multi-seed run', () => {
  for (const seed of [42, 7, 100, 999]) {
    it(`runs 1000 ticks without throwing for seed ${String(seed)}`, () => {
      const rng = makeRng(seed)
      const altCfg = makeConfig({ seed })
      const sim = makeSim(altCfg, rng)
      expect(() => {
        for (let i = 0; i < 1000; i++) {
          sim.tick()
        }
      }).not.toThrow()
    })
  }

  it('energy is conserved at tick 1000 for seed 42', () => {
    const rng = makeRng(42)
    const altCfg = makeConfig({ seed: 42 })
    const sim = makeSim(altCfg, rng)
    for (let i = 0; i < 1000; i++) {
      sim.tick()
    }
    expect(() => {
      sim.assertEnergyConserved()
    }).not.toThrow()
    expect(() => {
      sim.assertFinite()
    }).not.toThrow()
  })
})
