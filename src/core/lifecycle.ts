/**
 * Lifecycle: death conditions, corpse creation, reproduction.
 *
 * Story 4.3 implements checkDeath. Reproduction comes in a later story.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §5.3, §4.1, §6.3, §6.4.
 */

import type { Entity, EntityId } from './entity.js'
import type { Ledger } from './energy.js'
import type { DeadMatterRegistry, Corpse } from './deadMatter.js'
import type { Config } from './config.js'
import type { Rng } from './rng.js'

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
 */
export function checkDeath(
  entity: Entity,
  ledger: Ledger,
  deadMatter: DeadMatterRegistry,
  cfg: Config,
): DeathResult {
  const dies = entity.age >= entity.lifespan || entity.energy <= cfg.energyEpsilon
  if (!dies) return { died: false, corpse: null }

  if (entity.energy > 0) {
    const corpse = deadMatter.addCorpse(entity.position, entity.energy)
    if (corpse !== null) {
      ledger.register({ kind: 'corpse', id: corpse.id }, 0)
      ledger.transfer(
        { kind: 'entity', id: entity.id },
        { kind: 'corpse', id: corpse.id },
        entity.energy,
      )
    }
    ledger.unregister({ kind: 'entity', id: entity.id })
    entity.energy = 0
    return { died: true, corpse }
  }

  ledger.unregister({ kind: 'entity', id: entity.id })
  return { died: true, corpse: null }
}

/**
 * Process a reproduction request for an entity.
 *
 * If `entity.reproRequested` is true, creates a child entity, transfers
 * `reproCostFraction` of parent energy to the child via the ledger, applies
 * genome and stats mutation, resets the flag, and records `lastReproTick`.
 *
 * Returns the new child Entity, or null if `reproRequested` was false.
 *
 * Story 4.3 AC2. Spec §6.1, §6.2, §6.3, §8, §2.
 *
 * @stub — implementation pending GREEN phase
 */
export function processReproduction(
  entity: Entity,
  rng: Rng,
  ledger: Ledger,
  cfg: Config,
  currentTick: number,
  childId: EntityId,
): Entity | null {
  throw new Error(
    `processReproduction not implemented: entity=${String(entity.id)} rng=${typeof rng} ledger=${typeof ledger} cfg=${typeof cfg} currentTick=${String(currentTick)} childId=${String(childId)}`,
  )
}
