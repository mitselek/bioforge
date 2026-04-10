/**
 * Eating / predation: unified energy transfer from prey to predator.
 *
 * Implements the unified predation model from spec §3.5 for all
 * herbivore→plant, carnivore→herbivore, and decomposer→corpse/poop interactions.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §3.5, §3.6.
 */

import type { Entity } from './entity.js'
import type { Ledger } from './energy.js'
import type { Config } from './config.js'

/**
 * Apply one tick of eating: transfer energy from prey to predator.
 *
 * Flow (spec §3.5):
 * 1. eaten = min(predator.stats.eatRate * dt, prey.energy)
 * 2. Ledger: transfer `eaten` from prey pool to predator pool
 * 3. predator.wasteBuffer += eaten * (1 - predator.stats.efficiency)
 * 4. Update entity.energy fields to match ledger balances
 *
 * The waste portion stays inside the predator's entity pool (tracked via
 * wasteBuffer) until waste deposition drops it as poop/compost.
 *
 * Story 4.4 AC1. Spec §3.5, §3.6, §2.
 *
 * @stub — implementation pending GREEN phase
 */
export function applyEating(
  predator: Entity,
  prey: Entity,
  dt: number,
  ledger: Ledger,
  cfg: Config,
): void {
  void cfg
  const eaten = Math.min(predator.stats.eatRate * dt, prey.energy)
  if (eaten === 0) return
  const wasted = eaten * (1 - predator.stats.efficiency)
  ledger.transfer({ kind: 'entity', id: prey.id }, { kind: 'entity', id: predator.id }, eaten)
  predator.energy += eaten
  prey.energy -= eaten
  predator.wasteBuffer += wasted
}
