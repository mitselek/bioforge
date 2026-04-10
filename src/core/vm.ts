/**
 * Genome VM: executes one instruction per tick per entity.
 *
 * RED-phase stub — implementation in GREEN.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §7.3, §7.4, §7.6.
 */

import type { Entity } from './entity.js'
import type { Config } from './config.js'

export function executeOne(entity: Entity, dt: number, cfg: Config): void {
  throw new Error(
    `vm.executeOne: not implemented (ip=${String(entity.genome.ip)} dt=${String(dt)} turnRate=${String(cfg.turnRate)})`,
  )
}
