/**
 * Metabolism: base energy drain, age increment, and waste dropping per tick.
 *
 * Story 4.2 implements applyMetabolism and checkWasteDrop.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §5.1, §5.2, §6.2, §4.2, §4.3.
 */

import type { Entity } from './entity.js'
import type { Ledger } from './energy.js'
import type { DeadMatterRegistry, Poop, Compost } from './deadMatter.js'
import type { Config } from './config.js'

/**
 * Apply one tick of base metabolism to an entity.
 *
 * Transfers `baseMetabolicRate * dt` from the entity pool to soil via the
 * ledger, clamped to the entity's available energy. Increments `entity.age`
 * by 1.
 *
 * Story 4.2 AC1. Spec §5.1, §5.2, §6.2.
 */
/**
 * Check if entity's wasteBuffer has reached the drop threshold and, if so,
 * deposit it as poop (non-decomposers) or compost (decomposers).
 *
 * Energy flows from the entity pool to the new dead matter pool via the ledger.
 * WasteBuffer is reset to 0 after dropping.
 *
 * Returns the created Poop or Compost, or null if threshold not met.
 *
 * Story 4.2 AC4+AC5. Spec §4.2, §4.3, §2.
 */
export function checkWasteDrop(
  entity: Entity,
  ledger: Ledger,
  deadMatter: DeadMatterRegistry,
  cfg: Config,
): Poop | Compost | null {
  throw new Error(
    `checkWasteDrop not implemented: entity=${String(entity.id)} ledger=${typeof ledger} deadMatter=${typeof deadMatter} cfg=${typeof cfg}`,
  )
}

export function applyMetabolism(entity: Entity, dt: number, ledger: Ledger): void {
  const cost = entity.stats.baseMetabolicRate * dt
  const actual = Math.min(cost, entity.energy)
  if (actual > 0) {
    ledger.transfer({ kind: 'entity', id: entity.id }, { kind: 'soil' }, actual)
    entity.energy -= actual
  }
  entity.age += 1
}
