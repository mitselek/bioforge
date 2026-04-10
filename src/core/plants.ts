/**
 * Plant-specific behaviour: soil absorption and compost-adjacent spawning.
 *
 * Story 4.4 AC4.4.5-9 implements applyPlantAbsorption and tryCompostSpawn.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §3.1, §6.3, §2.
 */

import type { Entity, EntityId } from './entity.js'
import type { Ledger } from './energy.js'
import type { DeadMatterRegistry, Compost } from './deadMatter.js'
import type { Config } from './config.js'
import type { Rng } from './rng.js'

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
  throw new Error(
    `applyPlantAbsorption not implemented: plant=${String(plant.id)} nearbyCompostCount=${String(nearbyCompostCount)} dt=${String(dt)} ledger=${typeof ledger} cfg=${typeof cfg}`,
  )
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
  throw new Error(
    `tryCompostSpawn not implemented: compost=${String(compost.id)} childId=${String(childId)} rng=${typeof rng} ledger=${typeof ledger} deadMatter=${typeof deadMatter} cfg=${typeof cfg}`,
  )
}
