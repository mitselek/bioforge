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
  if (entity.wasteBuffer < cfg.poopThreshold) return null

  const available = ledger.get({ kind: 'entity', id: entity.id })
  const dropAmount = Math.min(entity.wasteBuffer, available)
  if (dropAmount <= 0) return null

  if (entity.species === 'decomposer') {
    const compost = deadMatter.addCompost(entity.position, dropAmount)
    ledger.register({ kind: 'compost', id: compost.id }, 0)
    ledger.transfer(
      { kind: 'entity', id: entity.id },
      { kind: 'compost', id: compost.id },
      dropAmount,
    )
    entity.energy -= dropAmount
    entity.wasteBuffer -= dropAmount
    return compost
  }

  const poop = deadMatter.addPoop(entity.position, dropAmount)
  ledger.register({ kind: 'poop', id: poop.id }, 0)
  ledger.transfer({ kind: 'entity', id: entity.id }, { kind: 'poop', id: poop.id }, dropAmount)
  entity.energy -= dropAmount
  entity.wasteBuffer -= dropAmount
  return poop
}

/**
 * Apply one tick of base metabolism to an entity.
 *
 * Transfers `baseMetabolicRate * dt` from the entity pool to soil via the
 * ledger, clamped to the entity's available energy. Increments `entity.age`
 * by 1.
 *
 * Story 4.2 AC1. Spec §5.1, §5.2, §6.2.
 */
export function applyMetabolism(entity: Entity, dt: number, ledger: Ledger): void {
  const cost = entity.stats.baseMetabolicRate * dt
  const actual = Math.min(cost, entity.energy)
  if (actual > 0) {
    ledger.transfer({ kind: 'entity', id: entity.id }, { kind: 'soil' }, actual)
    entity.energy -= actual
  }
  entity.age += 1
}
