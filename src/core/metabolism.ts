/**
 * Metabolism: base energy drain and age increment per tick.
 *
 * Story 4.2 implements applyMetabolism. Waste deposition (wasteBuffer) comes
 * in a later story.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §5.1, §5.2, §6.2.
 */

import type { Entity } from './entity.js'
import type { Ledger } from './energy.js'

/**
 * Apply one tick of base metabolism to an entity.
 *
 * Transfers `baseMetabolicRate * dt` from the entity pool to soil via the
 * ledger, clamped to the entity's available energy. Increments `entity.age`
 * by 1.
 *
 * Story 4.2 AC1. Spec §5.1, §5.2, §6.2.
 *
 * @stub — implementation pending GREEN phase
 */
export function applyMetabolism(entity: Entity, dt: number, ledger: Ledger): void {
  throw new Error(
    `applyMetabolism not implemented: entity=${String(entity.id)} dt=${String(dt)} ledger=${typeof ledger}`,
  )
}
