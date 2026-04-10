/**
 * Sim: top-level simulation container.
 *
 * `makeSim(cfg, rng)` seeds the world with entities per species, registers all
 * pools in the energy ledger, and exposes a `tick()` method and a read-only
 * `state` snapshot.
 *
 * Story 5.1 implements AC5.1.1-3.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §10, §17, §2.
 */

import type { Config, Species } from './config.js'
import type { Rng } from './rng.js'
import { makeEntity, entityId } from './entity.js'
import type { Entity } from './entity.js'
import { makeLedger } from './energy.js'
import type { Ledger } from './energy.js'
import type { DeadMatterRegistry } from './deadMatter.js'
import type { SpatialIndex } from './physics.js'
import { randomGenome } from './genome.js'

export interface SimState {
  readonly tick: number
  readonly entities: ReadonlyMap<number, Entity>
}

export interface Sim {
  tick(): void
  assertEnergyConserved(): void
  assertFinite(): void
  readonly state: SimState
}

/**
 * Create a new simulation seeded from `cfg` using `rng` for all stochastic
 * decisions. Stub implementation — throws on `tick()`.
 *
 * Story 5.1 AC5.1.1-3. Spec §10, §17, §2.
 */
export function makeSim(cfg: Config, rng: Rng): Sim {
  const entities = new Map<number, Entity>()
  let totalLiving = 0

  const species: Species[] = ['plant', 'herbivore', 'carnivore', 'decomposer']
  let nextId = 1
  for (const sp of species) {
    const stats = cfg.species[sp]
    const count = cfg.initialCounts[sp]
    for (let i = 0; i < count; i++) {
      const lifespan = Math.max(1, rng.gaussian(stats.lifespanMean, stats.lifespanStddev))
      const maturityAge = Math.min(
        Math.max(0, rng.gaussian(stats.maturityAgeMean, stats.maturityAgeStddev)),
        lifespan - cfg.minReproWindow - 1,
      )
      const entity = makeEntity({
        id: entityId(nextId),
        species: sp,
        position: { x: rng.floatInRange(0, cfg.worldW), y: rng.floatInRange(0, cfg.worldH) },
        orientation: rng.floatInRange(0, 2 * Math.PI),
        energy: stats.initialEnergy,
        lifespan,
        maturityAge,
        genome: randomGenome(rng, cfg),
        stats,
      })
      entities.set(nextId, entity)
      totalLiving += stats.initialEnergy
      nextId++
    }
  }

  const soilEnergy = cfg.totalEnergy - totalLiving
  const ledger = makeLedger({ totalEnergy: cfg.totalEnergy, initialSoil: soilEnergy })
  for (const entity of entities.values()) {
    ledger.register({ kind: 'entity', id: entity.id }, entity.energy)
  }

  const tick = 0

  return {
    get state(): SimState {
      return { tick, entities }
    },
    tick(): void {
      throw new Error('tick not implemented')
    },
    assertEnergyConserved(): void {
      ledger.assertEnergyConserved()
    },
    assertFinite(): void {
      ledger.assertFinite()
    },
  }
}

// Re-export internal types so tests can reference them without reaching into
// implementation modules directly through sim. These are the types the Sim
// owns at runtime.
export type { Ledger, DeadMatterRegistry, SpatialIndex }
