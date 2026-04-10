/**
 * Decomposition: decomposer eating of dead matter and corpse passive decay.
 *
 * Story 4.4 implements applyDecomposerEating and applyCorpseDecay.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §3.5, §4.1, §3.6, §2.
 */

import type { Entity } from './entity.js'
import type { Ledger } from './energy.js'
import type { Corpse, Poop } from './deadMatter.js'
import type { Config } from './config.js'

/**
 * Apply one tick of decomposer eating against a corpse or poop target.
 *
 * Uses the unified eating model (spec §3.5):
 * - eaten = min(decomposer.stats.eatRate * dt, target.energy)
 * - Transfer eaten from target pool to decomposer entity pool via ledger
 * - decomposer.wasteBuffer += eaten * (1 - efficiency)
 * - Update energy fields to match ledger
 *
 * Story 4.4 AC4.4.1. Spec §3.5, §3.6, §2.
 */
export function applyDecomposerEating(
  decomposer: Entity,
  target: Corpse | Poop,
  dt: number,
  ledger: Ledger,
  cfg: Config,
): void {
  throw new Error(
    `applyDecomposerEating not implemented: decomposer=${String(decomposer.id)} dt=${String(dt)} ledger=${typeof ledger} cfg=${typeof cfg} target=${String(target.id)}`,
  )
}

/**
 * Apply one tick of passive corpse decay: transfer corpseDecayRate * dt
 * from the corpse pool to soil via the ledger. Clamped to available energy.
 *
 * Returns true if the corpse energy reaches zero (flagged for removal).
 *
 * Story 4.4 AC4.4.3-4. Spec §4.1, §2.
 */
export function applyCorpseDecay(corpse: Corpse, dt: number, ledger: Ledger, cfg: Config): boolean {
  throw new Error(
    `applyCorpseDecay not implemented: corpse=${String(corpse.id)} dt=${String(dt)} ledger=${typeof ledger} cfg=${typeof cfg}`,
  )
}
