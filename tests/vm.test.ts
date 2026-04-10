import { describe, it, expect } from 'vitest'
import { executeOne } from '../src/core/vm.js'
import type { VmContext } from '../src/core/vm.js'
import type { Entity } from '../src/core/entity.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'
import { makeSpatialIndex } from '../src/core/physics.js'
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
  const ctx: VmContext = {
    cfg,
    index: makeSpatialIndex(80, 30, 15),
    getEntity: () => undefined,
    worldW: 80,
    worldH: 30,
    currentTick: 1000,
  }

  describe('MOVE_FORWARD (AC3.4.1)', () => {
    it('sets entity velocity based on arg1 * maxSpeed * heading', () => {
      const entity = makeTestEntity([{ op: 'MOVE_FORWARD', arg1: 0.5 }])
      executeOne(entity, dt, ctx)
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
      executeOne(entity, dt, ctx)
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
      executeOne(entity, dt, ctx)
      expect(entity.velocity.x).toBe(0)
      expect(entity.velocity.y).toBe(0)
    })
  })

  describe('TURN_LEFT / TURN_RIGHT (AC3.4.3)', () => {
    it('TURN_LEFT rotates orientation negatively', () => {
      const entity = makeTestEntity([{ op: 'TURN_LEFT', arg1: 1.0 }])
      const before = entity.orientation
      executeOne(entity, dt, ctx)
      // turn amount = -arg1 * turnRate * dt = -1.0 * pi * (1/30) ~= -0.1047
      expect(entity.orientation).toBeLessThan(before)
    })

    it('TURN_RIGHT rotates orientation positively', () => {
      const entity = makeTestEntity([{ op: 'TURN_RIGHT', arg1: 1.0 }])
      const before = entity.orientation
      executeOne(entity, dt, ctx)
      expect(entity.orientation).toBeGreaterThan(before)
    })

    it('turn is time-dependent (scales with dt)', () => {
      const e1 = makeTestEntity([{ op: 'TURN_RIGHT', arg1: 0.5 }])
      const e2 = makeTestEntity([{ op: 'TURN_RIGHT', arg1: 0.5 }])
      executeOne(e1, 1 / 30, ctx)
      executeOne(e2, 2 / 30, ctx)
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
      executeOne(entity, dt, ctx)
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
      executeOne(entity, dt, ctx)
      expect(entity.genome.ip).toBe(1)
    })

    it('wraps ip around tape length', () => {
      const entity = makeTestEntity([{ op: 'MOVE_FORWARD', arg1: 0.5 }])
      // Tape length 1, ip starts at 0, after execution ip wraps to 0
      executeOne(entity, dt, ctx)
      expect(entity.genome.ip).toBe(0)
    })

    it('handles multi-instruction tape cycling', () => {
      const entity = makeTestEntity([
        { op: 'MOVE_FORWARD', arg1: 0.5 },
        { op: 'TURN_LEFT', arg1: 0.3 },
        { op: 'TURN_RIGHT', arg1: 0.2 },
      ])
      executeOne(entity, dt, ctx) // ip: 0->1
      executeOne(entity, dt, ctx) // ip: 1->2
      executeOne(entity, dt, ctx) // ip: 2->0 (wrap)
      expect(entity.genome.ip).toBe(0)
    })
  })

  describe('SENSE_FOOD / SENSE_PREDATOR / SENSE_MATE (AC3.4.5)', () => {
    it('SENSE_FOOD populates lastSense with detected target', () => {
      const idx = makeSpatialIndex(80, 30, 15)
      idx.insert(2, { x: 45, y: 15 }) // plant 5 units east of entity
      const senseCtx: VmContext = {
        cfg,
        index: idx,
        getEntity: (id: number) =>
          id === 2 ? { species: 'plant', position: { x: 45, y: 15 } } : undefined,
        worldW: 80,
        worldH: 30,
        currentTick: 1000,
      }
      const entity = makeTestEntity([
        { op: 'SENSE_FOOD', arg1: 1.0, arg2: 1.0 }, // full spread, full range
      ])
      executeOne(entity, dt, senseCtx)
      expect(entity.lastSense.detected).toBe(true)
      expect(entity.lastSense.kind).toBe('food')
      expect(entity.lastSense.distance).toBeCloseTo(5)
    })

    it('SENSE_PREDATOR detects carnivore for herbivore', () => {
      const idx = makeSpatialIndex(80, 30, 15)
      idx.insert(2, { x: 45, y: 15 })
      const senseCtx: VmContext = {
        cfg,
        index: idx,
        getEntity: (id: number) =>
          id === 2 ? { species: 'carnivore', position: { x: 45, y: 15 } } : undefined,
        worldW: 80,
        worldH: 30,
        currentTick: 1000,
      }
      const entity = makeTestEntity([{ op: 'SENSE_PREDATOR', arg1: 1.0, arg2: 1.0 }])
      executeOne(entity, dt, senseCtx)
      expect(entity.lastSense.detected).toBe(true)
      expect(entity.lastSense.kind).toBe('predator')
    })
  })

  describe('JUMP_IF_TRUE 4-band conditions (AC3.4.6)', () => {
    it('band [0.75, 1]: jumps when target is to the right', () => {
      const entity = makeTestEntity([
        { op: 'JUMP_IF_TRUE', arg1: 0.8, target: 0 }, // band = right
        { op: 'MOVE_FORWARD', arg1: 0.5 },
      ])
      // Set lastSense to "detected, angle > 0 (right)"
      entity.lastSense = {
        kind: 'food',
        angle: 0.5, // positive = right
        distance: 5,
        detected: true,
        spread: 1,
        range: 10,
      }
      executeOne(entity, dt, ctx)
      // Should jump to target 0 -> ip = 0
      expect(entity.genome.ip).toBe(0)
    })

    it('band [0.75, 1]: does NOT jump when target is to the left', () => {
      const entity = makeTestEntity([
        { op: 'JUMP_IF_TRUE', arg1: 0.8, target: 0 },
        { op: 'MOVE_FORWARD', arg1: 0.5 },
      ])
      entity.lastSense = {
        kind: 'food',
        angle: -0.5, // negative = left
        distance: 5,
        detected: true,
        spread: 1,
        range: 10,
      }
      executeOne(entity, dt, ctx)
      // Should NOT jump -> ip advances to 1
      expect(entity.genome.ip).toBe(1)
    })

    it('band [0.00, 0.25): jumps when anything detected', () => {
      const entity = makeTestEntity([
        { op: 'JUMP_IF_TRUE', arg1: 0.1, target: 0 },
        { op: 'MOVE_FORWARD', arg1: 0.5 },
      ])
      entity.lastSense = {
        kind: 'food',
        angle: -0.3,
        distance: 5,
        detected: true,
        spread: 1,
        range: 10,
      }
      executeOne(entity, dt, ctx)
      expect(entity.genome.ip).toBe(0) // jumped
    })

    it('band [0.25, 0.50): jumps when nothing detected', () => {
      const entity = makeTestEntity([
        { op: 'JUMP_IF_TRUE', arg1: 0.35, target: 0 },
        { op: 'MOVE_FORWARD', arg1: 0.5 },
      ])
      // lastSense = not detected (default NO_SENSE)
      executeOne(entity, dt, ctx)
      expect(entity.genome.ip).toBe(0) // jumped (nothing detected = true for this band)
    })

    it('band [0.50, 0.75): jumps when target is to the left', () => {
      const entity = makeTestEntity([
        { op: 'JUMP_IF_TRUE', arg1: 0.6, target: 0 },
        { op: 'MOVE_FORWARD', arg1: 0.5 },
      ])
      entity.lastSense = {
        kind: 'food',
        angle: -0.5, // left
        distance: 5,
        detected: true,
        spread: 1,
        range: 10,
      }
      executeOne(entity, dt, ctx)
      expect(entity.genome.ip).toBe(0) // jumped
    })
  })

  describe('JUMP_IF_FALSE (AC3.4.7)', () => {
    it('jumps when condition is FALSE (inverted)', () => {
      const entity = makeTestEntity([
        { op: 'JUMP_IF_FALSE', arg1: 0.8, target: 0 }, // band = right
        { op: 'MOVE_FORWARD', arg1: 0.5 },
      ])
      entity.lastSense = {
        kind: 'food',
        angle: -0.5, // LEFT, not right
        distance: 5,
        detected: true,
        spread: 1,
        range: 10,
      }
      executeOne(entity, dt, ctx)
      // Condition "right?" is FALSE -> JUMP_IF_FALSE jumps
      expect(entity.genome.ip).toBe(0)
    })

    it('does NOT jump when condition is TRUE', () => {
      const entity = makeTestEntity([
        { op: 'JUMP_IF_FALSE', arg1: 0.8, target: 0 }, // band = right
        { op: 'MOVE_FORWARD', arg1: 0.5 },
      ])
      entity.lastSense = {
        kind: 'food',
        angle: 0.5, // RIGHT
        distance: 5,
        detected: true,
        spread: 1,
        range: 10,
      }
      executeOne(entity, dt, ctx)
      // Condition "right?" is TRUE -> JUMP_IF_FALSE does NOT jump
      expect(entity.genome.ip).toBe(1)
    })
  })

  describe('REPRODUCE (AC3.4.8)', () => {
    it('sets reproRequested when entity is eligible', () => {
      const entity = makeTestEntity([{ op: 'REPRODUCE', arg1: 0.5 }], {
        species: 'herbivore',
        energy: 200, // above reproThresholdEnergy (150)
      })
      entity.age = 500 // above maturityAge (300)
      entity.lastReproTick = -Infinity // cooldown satisfied
      executeOne(entity, dt, ctx)
      expect(entity.reproRequested).toBe(true)
    })

    it('does NOT set reproRequested when energy below threshold', () => {
      const entity = makeTestEntity([{ op: 'REPRODUCE', arg1: 0.5 }], {
        species: 'herbivore',
        energy: 50, // below reproThresholdEnergy (150)
      })
      entity.age = 500
      entity.lastReproTick = -Infinity
      executeOne(entity, dt, ctx)
      expect(entity.reproRequested).toBe(false)
    })

    it('does NOT set reproRequested when not mature', () => {
      const entity = makeTestEntity([{ op: 'REPRODUCE', arg1: 0.5 }], {
        species: 'herbivore',
        energy: 200,
      })
      entity.age = 100 // below maturityAge (300)
      entity.lastReproTick = -Infinity
      executeOne(entity, dt, ctx)
      expect(entity.reproRequested).toBe(false)
    })

    it('does NOT set reproRequested when cooldown not elapsed', () => {
      const entity = makeTestEntity([{ op: 'REPRODUCE', arg1: 0.5 }], {
        species: 'herbivore',
        energy: 200,
      })
      entity.age = 500
      entity.lastReproTick = 999 // reproduced 1 tick ago
      const recentCtx = { ...ctx, currentTick: 1000 }
      executeOne(entity, dt, recentCtx)
      expect(entity.reproRequested).toBe(false) // cooldown not elapsed (200 ticks required)
    })
  })

  describe('plant no-ops for REPRODUCE (AC3.4.10)', () => {
    it('REPRODUCE is a no-op for plants', () => {
      const entity = makeTestEntity([{ op: 'REPRODUCE', arg1: 0.5 }], {
        species: 'plant',
      })
      entity.age = 9999
      executeOne(entity, dt, ctx)
      expect(entity.reproRequested).toBe(false)
    })

    it('TURN_LEFT is a no-op for plants', () => {
      const entity = makeTestEntity([{ op: 'TURN_LEFT', arg1: 1.0 }], {
        species: 'plant',
      })
      executeOne(entity, dt, ctx)
      expect(entity.orientation).toBe(0) // unchanged
    })
  })
})
