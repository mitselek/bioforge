/**
 * Sim: top-level simulation container.
 *
 * `makeSim(cfg, rng)` seeds the world with entities per species, registers all
 * pools in the energy ledger, and exposes a `tick()` method and a read-only
 * `state` snapshot.
 *
 * Story 5.1 implements AC5.1.1-9.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §10, §17, §2.
 */

import type { Config, Species } from './config.js'
import { makeRng } from './rng.js'
import type { Rng } from './rng.js'
import { makeEntity, entityId } from './entity.js'
import type { Entity } from './entity.js'
import { makeLedger } from './energy.js'
import type { Ledger } from './energy.js'
import { makeDeadMatterRegistry } from './deadMatter.js'
import type { DeadMatterRegistry, CorpseId, CompostId } from './deadMatter.js'
import { makeSpatialIndex, applyMovement, applyMovementCost, resolveCollisions } from './physics.js'
import type { SpatialIndex } from './physics.js'
import { randomGenome } from './genome.js'
import { executeOne } from './vm.js'
import { applyMetabolism, checkWasteDrop } from './metabolism.js'
import { checkDeath, processReproduction } from './lifecycle.js'
import { applyEating } from './eating.js'
import { applyDecomposerEating, applyCorpseDecay } from './decomposition.js'
import { applyPlantAbsorption, tryCompostSpawn } from './plants.js'
import { torusDistance } from './world.js'

export interface SimState {
  readonly tick: number
  readonly entities: ReadonlyMap<number, Entity>
  readonly countsBySpecies: Readonly<Record<string, number>>
  readonly totalEnergy: number
}

export interface Sim {
  tick(): void
  reset(): void
  assertEnergyConserved(): void
  assertFinite(): void
  readonly state: SimState
}

/** Seed the initial entity map, ledger, and ID counter from config + rng. */
function seedState(
  cfg: Config,
  seedRng: Rng,
): { entities: Map<number, Entity>; ledger: Ledger; nextId: number } {
  const entities = new Map<number, Entity>()
  let totalLiving = 0
  const allSpecies: Species[] = ['plant', 'herbivore', 'carnivore', 'decomposer']
  let nextId = 1
  for (const sp of allSpecies) {
    const stats = cfg.species[sp]
    const count = cfg.initialCounts[sp]
    for (let i = 0; i < count; i++) {
      const lifespan = Math.max(1, seedRng.gaussian(stats.lifespanMean, stats.lifespanStddev))
      const maturityAge = Math.min(
        Math.max(0, seedRng.gaussian(stats.maturityAgeMean, stats.maturityAgeStddev)),
        lifespan - cfg.minReproWindow - 1,
      )
      const entity = makeEntity({
        id: entityId(nextId),
        species: sp,
        position: {
          x: seedRng.floatInRange(0, cfg.worldW),
          y: seedRng.floatInRange(0, cfg.worldH),
        },
        orientation: seedRng.floatInRange(0, 2 * Math.PI),
        energy: stats.initialEnergy,
        lifespan,
        maturityAge,
        genome: randomGenome(seedRng, cfg),
        stats,
      })
      entities.set(nextId, entity)
      totalLiving += stats.initialEnergy
      nextId++
    }
  }
  const soilEnergy = cfg.totalEnergy - totalLiving
  const ledger = makeLedger({
    totalEnergy: cfg.totalEnergy,
    initialSoil: soilEnergy,
    epsilon: cfg.energyEpsilon,
  })
  for (const entity of entities.values()) {
    ledger.register({ kind: 'entity', id: entity.id }, entity.energy)
  }
  return { entities, ledger, nextId }
}

/**
 * Create a new simulation seeded from `cfg` using `rng` for all stochastic
 * decisions.
 *
 * Story 5.1 AC5.1.1-9. Spec §10, §17, §2.
 */
export function makeSim(cfg: Config, rng: Rng): Sim {
  let { entities, ledger, nextId } = seedState(cfg, rng)
  let tickRng: Rng = rng
  let deadMatter = makeDeadMatterRegistry()
  const spatialIndex = makeSpatialIndex(cfg.worldW, cfg.worldH, 2)

  let currentTick = 0
  const dt = 1 / cfg.baseHz

  return {
    get state(): SimState {
      const countsBySpecies: Record<string, number> = {}
      for (const entity of entities.values()) {
        countsBySpecies[entity.species] = (countsBySpecies[entity.species] ?? 0) + 1
      }
      return { tick: currentTick, entities, countsBySpecies, totalEnergy: ledger.totalEnergy() }
    },

    tick(): void {
      // Step 1: advance clock (tick counter)
      currentTick++

      // Step 2: rebuild spatial index
      spatialIndex.clear()
      for (const [id, entity] of entities) {
        spatialIndex.insert(id, entity.position)
      }

      // Step 3: genome VM step
      const vmCtx = {
        cfg,
        index: spatialIndex,
        getEntity: (id: number) => entities.get(id),
        worldW: cfg.worldW,
        worldH: cfg.worldH,
        currentTick,
      }
      for (const [, entity] of [...entities].sort((a, b) => a[0] - b[0])) {
        executeOne(entity, dt, vmCtx)
      }

      // Step 4: physics — movement cost then movement
      for (const [, entity] of [...entities].sort((a, b) => a[0] - b[0])) {
        applyMovementCost(entity, dt, ledger)
        applyMovement(entity, dt, cfg.worldW, cfg.worldH)
      }

      // Step 5: physics — collisions
      resolveCollisions(entities, spatialIndex, cfg.worldW, cfg.worldH)

      // Step 6: metabolism
      for (const [, entity] of [...entities].sort((a, b) => a[0] - b[0])) {
        applyMetabolism(entity, dt, ledger)
      }

      // Step 7: interactions — eating
      // herbivores eat plants, carnivores eat herbivores, decomposers eat corpses+poop
      const sortedIds = [...entities.keys()].sort((a, b) => a - b)
      for (const id of sortedIds) {
        const entity = entities.get(id)
        if (entity === undefined) continue

        if (entity.species === 'herbivore') {
          // eat nearby plants
          const range = entity.stats.radius + cfg.species.plant.radius
          for (const nearId of spatialIndex.queryRadius(entity.position, range)) {
            const plant = entities.get(nearId)
            if (plant?.species !== 'plant') continue
            const dist = torusDistance(entity.position, plant.position, cfg.worldW, cfg.worldH)
            if (dist < range) {
              applyEating(entity, plant, dt, ledger, cfg)
            }
          }
        } else if (entity.species === 'carnivore') {
          // eat nearby herbivores
          const range = entity.stats.radius + cfg.species.herbivore.radius
          for (const nearId of spatialIndex.queryRadius(entity.position, range)) {
            const prey = entities.get(nearId)
            if (prey?.species !== 'herbivore') continue
            const dist = torusDistance(entity.position, prey.position, cfg.worldW, cfg.worldH)
            if (dist < range) {
              applyEating(entity, prey, dt, ledger, cfg)
            }
          }
        } else if (entity.species === 'decomposer') {
          // eat nearby corpses
          for (const corpse of deadMatter.corpses()) {
            const dist = torusDistance(entity.position, corpse.position, cfg.worldW, cfg.worldH)
            if (dist < entity.stats.radius) {
              applyDecomposerEating(
                entity,
                corpse,
                { kind: 'corpse', id: corpse.id },
                dt,
                ledger,
                cfg,
              )
            }
          }
          // eat nearby poop
          for (const poop of deadMatter.poop()) {
            const dist = torusDistance(entity.position, poop.position, cfg.worldW, cfg.worldH)
            if (dist < entity.stats.radius) {
              applyDecomposerEating(entity, poop, { kind: 'poop', id: poop.id }, dt, ledger, cfg)
            }
          }
        }
      }

      // Step 8: waste deposition
      for (const id of sortedIds) {
        const entity = entities.get(id)
        if (entity === undefined) continue
        checkWasteDrop(entity, ledger, deadMatter, cfg)
      }

      // Step 9: reproduction (mobile species only — not plants)
      const newChildren: Entity[] = []
      for (const id of sortedIds) {
        const entity = entities.get(id)
        if (entity === undefined || entity.species === 'plant') continue
        const child = processReproduction(
          entity,
          tickRng,
          ledger,
          cfg,
          currentTick,
          entityId(nextId),
          cfg.worldW,
          cfg.worldH,
        )
        if (child !== null) {
          newChildren.push(child)
          nextId++
        }
      }
      for (const child of newChildren) {
        entities.set(child.id, child)
      }

      // Step 10: deaths — starvation and old age
      const toRemove: number[] = []
      for (const id of sortedIds) {
        const entity = entities.get(id)
        if (entity === undefined) continue
        const result = checkDeath(entity, ledger, deadMatter, cfg)
        if (result.died) {
          toRemove.push(id)
          if (result.corpse !== null) {
            ledger.assertEnergyConserved()
          }
        }
      }
      for (const id of toRemove) {
        entities.delete(id)
      }

      // Step 11: decay — corpses return energy to soil
      const exhaustedCorpses: number[] = []
      for (const corpse of deadMatter.corpses()) {
        const done = applyCorpseDecay(corpse, dt, ledger, cfg)
        if (done) {
          ledger.unregister({ kind: 'corpse', id: corpse.id })
          exhaustedCorpses.push(corpse.id)
        }
      }
      for (const id of exhaustedCorpses) {
        deadMatter.removeCorpse(id as unknown as CorpseId)
      }

      // Step 12: plant lifecycle — absorption + compost-adjacent spawning
      const plantIds = sortedIds.filter((id) => entities.get(id)?.species === 'plant')
      for (const id of plantIds) {
        const plant = entities.get(id)
        if (plant === undefined) continue
        // count nearby composts within compostRadius
        let nearbyCompostCount = 0
        for (const compost of deadMatter.compost()) {
          const dist = torusDistance(plant.position, compost.position, cfg.worldW, cfg.worldH)
          if (dist <= cfg.compostRadius) nearbyCompostCount++
        }
        applyPlantAbsorption(plant, nearbyCompostCount, dt, ledger, cfg)
      }

      // compost-adjacent plant spawning
      const exhaustedCompost: number[] = []
      for (const compost of deadMatter.compost()) {
        const child = tryCompostSpawn(compost, entityId(nextId), tickRng, ledger, deadMatter, cfg)
        if (child !== null) {
          entities.set(child.id, child)
          nextId++
        }
        if (compost.energy <= 0) {
          ledger.unregister({ kind: 'compost', id: compost.id })
          exhaustedCompost.push(compost.id)
        }
      }
      for (const id of exhaustedCompost) {
        deadMatter.removeCompost(id as unknown as CompostId)
      }

      // Step 13: invariant checks (always on — guards energy conservation)
      ledger.assertEnergyConserved()
      ledger.assertFinite()
    },

    reset(): void {
      const freshRng = makeRng(cfg.seed)
      const reseeded = seedState(cfg, freshRng)
      entities = reseeded.entities
      ledger = reseeded.ledger
      nextId = reseeded.nextId
      tickRng = freshRng
      deadMatter = makeDeadMatterRegistry()
      spatialIndex.clear()
      currentTick = 0
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
