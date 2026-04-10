/**
 * Lifecycle: death conditions, corpse creation, reproduction.
 *
 * Story 4.3 implements checkDeath. Reproduction comes in a later story.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §5.3, §4.1, §6.3, §6.4.
 */

import type { Entity } from './entity.js'
import type { Ledger } from './energy.js'
import type { DeadMatterRegistry, Corpse } from './deadMatter.js'
import type { Config } from './config.js'

export interface DeathResult {
  readonly died: boolean
  readonly corpse: Corpse | null
}

/**
 * Check whether an entity should die this tick and, if so, create a corpse.
 *
 * Death conditions (spec §5.3):
 * - `age >= lifespan` (old age)
 * - `energy <= cfg.energyEpsilon` (starvation)
 *
 * On death:
 * - Entity's remaining energy is transferred to a new corpse via the ledger
 * - Entity pool is unregistered from the ledger
 * - Corpse is registered in the dead matter registry
 * - Zero-energy corpses are elided (spec §4.1)
 *
 * Story 4.3 AC1. Spec §5.3, §4.1, §2.5, §2.
 *
 * @stub — implementation pending GREEN phase
 */
export function checkDeath(
  entity: Entity,
  ledger: Ledger,
  deadMatter: DeadMatterRegistry,
  cfg: Config,
): DeathResult {
  throw new Error(
    `checkDeath not implemented: entity=${String(entity.id)} lifespan=${String(entity.lifespan)} age=${String(entity.age)} energy=${String(entity.energy)} ledger=${typeof ledger} deadMatter=${typeof deadMatter} cfg=${typeof cfg}`,
  )
}
