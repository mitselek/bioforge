/**
 * Genome VM: executes one instruction per tick per entity.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §7.3, §7.4, §7.6.
 */

import type { Entity } from './entity.js'
import type { Config } from './config.js'
import { normalizeAngle } from './world.js'

export function executeOne(entity: Entity, dt: number, cfg: Config): void {
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
      entity.orientation = normalizeAngle(entity.orientation - inst.arg1 * cfg.turnRate * dt)
      break
    }
    case 'TURN_RIGHT': {
      if (entity.species === 'plant') break
      entity.orientation = normalizeAngle(entity.orientation + inst.arg1 * cfg.turnRate * dt)
      break
    }
    case 'SENSE_FOOD':
    case 'SENSE_PREDATOR':
    case 'SENSE_MATE':
      // Cycle 2
      break
    case 'JUMP_IF_TRUE':
    case 'JUMP_IF_FALSE':
      // Cycle 2
      break
    case 'REPRODUCE':
      // Cycle 3
      break
  }

  // Advance IP (jumps will override this in Cycle 2)
  genome.ip = (genome.ip + 1) % genome.tape.length
}
