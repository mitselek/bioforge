/**
 * Genome VM: executes one instruction per tick per entity.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §7.3, §7.4, §7.6.
 */

import type { Entity } from './entity.js'
import type { Config } from './config.js'
import type { SpatialIndex } from './physics.js'
import type { Species } from './config.js'
import { normalizeAngle } from './world.js'

export interface VmContext {
  readonly cfg: Config
  readonly index: SpatialIndex
  readonly getEntity: (
    id: number,
  ) => { species: Species; position: { readonly x: number; readonly y: number } } | undefined
  readonly worldW: number
  readonly worldH: number
}

export function executeOne(entity: Entity, dt: number, ctx: VmContext): void {
  const { genome } = entity
  const inst = genome.tape[genome.ip]
  if (inst === undefined) {
    // Empty tape or invalid ip — no-op, advance ip
    genome.ip = (genome.ip + 1) % Math.max(1, genome.tape.length)
    return
  }

  switch (inst.op) {
    case 'MOVE_FORWARD': {
      if (entity.species === 'plant') break
      const speed = inst.arg1 * entity.stats.maxSpeed
      entity.velocity = {
        x: speed * Math.cos(entity.orientation),
        y: speed * Math.sin(entity.orientation),
      }
      break
    }
    case 'TURN_LEFT': {
      if (entity.species === 'plant') break
      entity.orientation = normalizeAngle(entity.orientation - inst.arg1 * ctx.cfg.turnRate * dt)
      break
    }
    case 'TURN_RIGHT': {
      if (entity.species === 'plant') break
      entity.orientation = normalizeAngle(entity.orientation + inst.arg1 * ctx.cfg.turnRate * dt)
      break
    }
    case 'SENSE_FOOD':
    case 'SENSE_PREDATOR':
    case 'SENSE_MATE':
      // Cycle 2 — stub: not yet implemented
      throw new Error(
        `vm.executeOne: SENSE not implemented (op=${inst.op} species=${entity.species})`,
      )
    case 'JUMP_IF_TRUE':
    case 'JUMP_IF_FALSE':
      // Cycle 2 — stub: not yet implemented
      throw new Error(
        `vm.executeOne: JUMP not implemented (op=${inst.op} arg1=${String(inst.arg1)})`,
      )
    case 'REPRODUCE':
      // Cycle 3
      break
  }

  // Advance IP (jumps will override this in Cycle 2)
  genome.ip = (genome.ip + 1) % genome.tape.length
}
