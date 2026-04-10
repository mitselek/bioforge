import { describe, it, expect } from 'vitest'
import { makeEntity, entityId, NO_SENSE } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'

describe('entity', () => {
  describe('NO_SENSE constant', () => {
    it('has detected: false', () => {
      expect(NO_SENSE.detected).toBe(false)
    })
    it('has angle: 0 and distance: 0', () => {
      expect(NO_SENSE.angle).toBe(0)
      expect(NO_SENSE.distance).toBe(0)
    })
    it('has spread: 0 and range: 0', () => {
      expect(NO_SENSE.spread).toBe(0)
      expect(NO_SENSE.range).toBe(0)
    })
  })

  describe('makeEntity factory', () => {
    const cfg = defaultConfig()

    const baseArgs = {
      id: entityId(1),
      species: 'herbivore' as const,
      position: { x: 10, y: 15 },
      orientation: 0,
      energy: 100,
      lifespan: 900,
      maturityAge: 300,
      stats: cfg.species.herbivore,
      // genome will be added in Story 2.3; for now use a placeholder
      genome: { tape: [], ip: 0 },
    }

    it('returns an entity with all required fields', () => {
      const e = makeEntity(baseArgs)
      expect(e.id).toBe(1)
      expect(e.species).toBe('herbivore')
      expect(e.position).toEqual({ x: 10, y: 15 })
      expect(e.orientation).toBe(0)
      expect(e.energy).toBe(100)
      expect(e.lifespan).toBe(900)
      expect(e.maturityAge).toBe(300)
      expect(e.stats).toBe(cfg.species.herbivore)
    })

    it('defaults age to 0', () => {
      const e = makeEntity(baseArgs)
      expect(e.age).toBe(0)
    })

    it('defaults velocity to {x:0, y:0}', () => {
      const e = makeEntity(baseArgs)
      expect(e.velocity).toEqual({ x: 0, y: 0 })
    })

    it('defaults wasteBuffer to 0', () => {
      const e = makeEntity(baseArgs)
      expect(e.wasteBuffer).toBe(0)
    })

    it('defaults lastSense to NO_SENSE', () => {
      const e = makeEntity(baseArgs)
      expect(e.lastSense).toEqual(NO_SENSE)
    })

    it('defaults lastReproTick to -Infinity (never reproduced)', () => {
      const e = makeEntity(baseArgs)
      expect(e.lastReproTick).toBe(-Infinity)
    })

    it('accepts an explicit age override', () => {
      const e = makeEntity({ ...baseArgs, age: 50 })
      expect(e.age).toBe(50)
    })
  })

  describe('entityId branding', () => {
    it('returns a number with the branded type', () => {
      const id = entityId(42)
      expect(id).toBe(42)
    })
  })
})
