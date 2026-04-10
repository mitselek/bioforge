import { describe, it, expect } from 'vitest'
import { executeOne } from '../src/core/vm.js'
import type { Entity } from '../src/core/entity.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'
import type { Instruction } from '../src/core/genome.js'

const cfg = defaultConfig()

// Helper: make a minimal entity with a given genome
function makeTestEntity(
  tape: Instruction[],
  overrides: Partial<{ species: Entity['species']; orientation: number; energy: number }> = {},
): Entity {
  return makeEntity({
    id: entityId(1),
    species: overrides.species ?? 'herbivore',
    position: { x: 40, y: 15 },
    orientation: overrides.orientation ?? 0,
    energy: overrides.energy ?? 100,
    lifespan: 900,
    maturityAge: 300,
    genome: { tape, ip: 0 },
    stats: cfg.species[overrides.species ?? 'herbivore'],
  })
}

describe('vm', () => {
  const dt = 1 / 30

  describe('MOVE_FORWARD (AC3.4.1)', () => {
    it('sets entity velocity based on arg1 * maxSpeed * heading', () => {
      const entity = makeTestEntity([{ op: 'MOVE_FORWARD', arg1: 0.5 }])
      executeOne(entity, dt, cfg)
      // herbivore maxSpeed = 1.2, arg1 = 0.5, orientation = 0 (east)
      // speed = 0.5 * 1.2 = 0.6
      // velocity = { x: 0.6 * cos(0), y: 0.6 * sin(0) } = { x: 0.6, y: 0 }
      expect(entity.velocity.x).toBeCloseTo(0.6)
      expect(entity.velocity.y).toBeCloseTo(0)
    })

    it('respects entity orientation', () => {
      const entity = makeTestEntity([{ op: 'MOVE_FORWARD', arg1: 1.0 }], {
        orientation: Math.PI / 2, // facing south
      })
      executeOne(entity, dt, cfg)
      // speed = 1.0 * 1.2 = 1.2
      // velocity = { x: 1.2*cos(pi/2), y: 1.2*sin(pi/2) } ~= { x: 0, y: 1.2 }
      expect(entity.velocity.x).toBeCloseTo(0, 5)
      expect(entity.velocity.y).toBeCloseTo(1.2)
    })
  })

  describe('MOVE_FORWARD plant no-op (AC3.4.2)', () => {
    it('is a no-op for plants (velocity stays zero)', () => {
      const entity = makeTestEntity([{ op: 'MOVE_FORWARD', arg1: 1.0 }], {
        species: 'plant',
      })
      executeOne(entity, dt, cfg)
      expect(entity.velocity.x).toBe(0)
      expect(entity.velocity.y).toBe(0)
    })
  })

  describe('TURN_LEFT / TURN_RIGHT (AC3.4.3)', () => {
    it('TURN_LEFT rotates orientation negatively', () => {
      const entity = makeTestEntity([{ op: 'TURN_LEFT', arg1: 1.0 }])
      const before = entity.orientation
      executeOne(entity, dt, cfg)
      // turn amount = -arg1 * turnRate * dt = -1.0 * pi * (1/30) ~= -0.1047
      expect(entity.orientation).toBeLessThan(before)
    })

    it('TURN_RIGHT rotates orientation positively', () => {
      const entity = makeTestEntity([{ op: 'TURN_RIGHT', arg1: 1.0 }])
      const before = entity.orientation
      executeOne(entity, dt, cfg)
      expect(entity.orientation).toBeGreaterThan(before)
    })

    it('turn is time-dependent (scales with dt)', () => {
      const e1 = makeTestEntity([{ op: 'TURN_RIGHT', arg1: 0.5 }])
      const e2 = makeTestEntity([{ op: 'TURN_RIGHT', arg1: 0.5 }])
      executeOne(e1, 1 / 30, cfg)
      executeOne(e2, 2 / 30, cfg)
      // e2 should have turned roughly twice as far
      expect(Math.abs(e2.orientation)).toBeCloseTo(Math.abs(e1.orientation) * 2, 1)
    })
  })

  describe('orientation normalization (AC3.4.4)', () => {
    it('orientation stays in [-pi, pi] after turning', () => {
      // Start near pi, turn right — should wrap
      const entity = makeTestEntity([{ op: 'TURN_RIGHT', arg1: 1.0 }], {
        orientation: Math.PI - 0.01,
      })
      executeOne(entity, dt, cfg)
      expect(entity.orientation).toBeGreaterThanOrEqual(-Math.PI)
      expect(entity.orientation).toBeLessThanOrEqual(Math.PI)
    })
  })

  describe('IP advancement (AC3.4.9)', () => {
    it('advances ip by 1 after execution', () => {
      const entity = makeTestEntity([
        { op: 'MOVE_FORWARD', arg1: 0.5 },
        { op: 'TURN_LEFT', arg1: 0.3 },
      ])
      expect(entity.genome.ip).toBe(0)
      executeOne(entity, dt, cfg)
      expect(entity.genome.ip).toBe(1)
    })

    it('wraps ip around tape length', () => {
      const entity = makeTestEntity([{ op: 'MOVE_FORWARD', arg1: 0.5 }])
      // Tape length 1, ip starts at 0, after execution ip wraps to 0
      executeOne(entity, dt, cfg)
      expect(entity.genome.ip).toBe(0)
    })

    it('handles multi-instruction tape cycling', () => {
      const entity = makeTestEntity([
        { op: 'MOVE_FORWARD', arg1: 0.5 },
        { op: 'TURN_LEFT', arg1: 0.3 },
        { op: 'TURN_RIGHT', arg1: 0.2 },
      ])
      executeOne(entity, dt, cfg) // ip: 0->1
      executeOne(entity, dt, cfg) // ip: 1->2
      executeOne(entity, dt, cfg) // ip: 2->0 (wrap)
      expect(entity.genome.ip).toBe(0)
    })
  })
})
