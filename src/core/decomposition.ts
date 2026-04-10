/**
 * Decomposition: decomposer eating of dead matter and corpse passive decay.
 *
 * Story 4.4 implements applyDecomposerEating and applyCorpseDecay.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §3.5, §4.1, §3.6, §2.
 */

import type { Entity } from './entity.js'
import type { EnergyPool, Ledger } from './energy.js'
import type { Corpse, Poop } from './deadMatter.js'
import type { Config } from './config.js'

/**
 * Apply one tick of decomposer eating against a corpse or poop target.
 *
 * The caller provides `targetPool` — the ledger pool corresponding to the
 * target dead matter item. This avoids the need for a runtime discriminant
 * on Corpse vs Poop (their branded IDs are compile-time only).
 *
 * Uses the unified eating model (spec §3.5):
 * - eaten = min(decomposer.stats.eatRate * dt, target.energy)
 * - Transfer eaten from targetPool to decomposer entity pool via ledger
 * - decomposer.wasteBuffer += eaten * (1 - efficiency)
 * - Update energy fields to match ledger
 *
 * Story 4.4 AC4.4.1. Spec §3.5, §3.6, §2.
 */
export function applyDecomposerEating(
  decomposer: Entity,
  target: Corpse | Poop,
  targetPool: EnergyPool,
  dt: number,
  ledger: Ledger,
  cfg: Config,
): void {
  throw new Error(
    `applyDecomposerEating not implemented: decomposer=${String(decomposer.id)} target=${String(target.id)} dt=${String(dt)} ledger=${typeof ledger} cfg=${typeof cfg} targetPool=${targetPool.kind}`,
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
  const decay = Math.min(cfg.corpseDecayRate * dt, corpse.energy)
  if (decay > 0) {
    ledger.transfer({ kind: 'corpse', id: corpse.id }, { kind: 'soil' }, decay)
    corpse.energy -= decay
  }
  return corpse.energy <= 0
}
