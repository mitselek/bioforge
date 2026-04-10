/**
 * Plant-specific behaviour: soil absorption and compost-adjacent spawning.
 *
 * Story 4.4 AC4.4.5-9 implements applyPlantAbsorption and tryCompostSpawn.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §3.1, §6.3, §2.
 */

import { makeEntity } from './entity.js'
import type { Entity, EntityId } from './entity.js'
import type { Ledger } from './energy.js'
import type { DeadMatterRegistry, Compost } from './deadMatter.js'
import type { Config } from './config.js'
import type { Rng } from './rng.js'
import { randomGenome } from './genome.js'

/**
 * Apply one tick of soil absorption to a plant.
 *
 * Absorbs `absorbRate * dt * boostMultiplier` from the soil pool, clamped to
 * available soil. boostMultiplier = min(1 + compostBoost * nearbyCompostCount, compostBoostCap).
 *
 * Story 4.4 AC4.4.5-6. Spec §3.1, §6.3, §2.
 */
export function applyPlantAbsorption(
  plant: Entity,
  nearbyCompostCount: number,
  dt: number,
  ledger: Ledger,
  cfg: Config,
): void {
  const boostMultiplier = Math.min(1 + cfg.compostBoost * nearbyCompostCount, cfg.compostBoostCap)
  const desired = plant.stats.absorbRate * dt * boostMultiplier
  const actual = Math.min(desired, ledger.get({ kind: 'soil' }))
  if (actual > 0) {
    ledger.transfer({ kind: 'soil' }, { kind: 'entity', id: plant.id }, actual)
    plant.energy += actual
  }
}

/**
 * Per-compost per-tick: roll for a compost-adjacent plant spawn.
 *
 * Probability = plantSpawnBaseProb * 4. If autoSpawnPlants is false, always
 * returns null. If the roll succeeds, transfers compost energy to the new
 * plant (topping up from soil if needed), registers pools via ledger, and
 * returns the new plant Entity.
 *
 * Story 4.4 AC4.4.7-9. Spec §6.3, §2.
 */
export function tryCompostSpawn(
  compost: Compost,
  childId: EntityId,
  rng: Rng,
  ledger: Ledger,
  deadMatter: DeadMatterRegistry,
  cfg: Config,
): Entity | null {
  void deadMatter
  if (!cfg.autoSpawnPlants) return null
  const spawnProb = cfg.plantSpawnBaseProb * 4
  if (rng.float() >= spawnProb) return null

  const plantStats = cfg.species.plant
  const initialEnergy = plantStats.initialEnergy
  ledger.register({ kind: 'entity', id: childId }, 0)
  const fromCompost = Math.min(compost.energy, initialEnergy)
  ledger.transfer({ kind: 'compost', id: compost.id }, { kind: 'entity', id: childId }, fromCompost)
  compost.energy -= fromCompost
  const topUp = initialEnergy - fromCompost
  if (topUp > 0) {
    ledger.transfer({ kind: 'soil' }, { kind: 'entity', id: childId }, topUp)
  }
  const lifespan = Math.max(1, rng.gaussian(plantStats.lifespanMean, plantStats.lifespanStddev))
  const maturityAge = Math.min(
    Math.max(0, rng.gaussian(plantStats.maturityAgeMean, plantStats.maturityAgeStddev)),
    lifespan - cfg.minReproWindow - 1,
  )
  return makeEntity({
    id: childId,
    species: 'plant',
    position: compost.position,
    orientation: 0,
    energy: initialEnergy,
    lifespan,
    maturityAge,
    genome: randomGenome(rng, cfg),
    stats: plantStats,
  })
}
