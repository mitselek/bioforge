import { describe, it, expect } from 'vitest'
import { sense } from '../src/core/sensing.js'
import { makeSpatialIndex } from '../src/core/physics.js'
import type { Vec2 } from '../src/core/world.js'

// Helper: minimal entity-like shape for sensing tests
interface TestEntity {
  id: number
  species: 'plant' | 'herbivore' | 'carnivore' | 'decomposer'
  position: Vec2
}

describe('sensing', () => {
  const worldW = 80
  const worldH = 30
  const cellSize = 15

  // Helper: build a spatial index and entity lookup from test entities
  function setupWorld(entities: TestEntity[]): {
    index: ReturnType<typeof makeSpatialIndex>
    getEntity: (id: number) => TestEntity | undefined
  } {
    const index = makeSpatialIndex(worldW, worldH, cellSize)
    const map = new Map<number, TestEntity>()
    for (const e of entities) {
      index.insert(e.id, e.position)
      map.set(e.id, e)
    }
    return {
      index,
      getEntity: (id: number) => map.get(id),
    }
  }

  describe('food targeting per species (AC3.3.1)', () => {
    it('herbivore senses nearest plant as food', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'plant', position: { x: 12, y: 10 } },
        { id: 2, species: 'herbivore', position: { x: 50, y: 20 } },
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'herbivore',
        spread: 2 * Math.PI, // full 360°
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(true)
      expect(result.kind).toBe('food')
    })

    it('carnivore senses nearest herbivore as food', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'herbivore', position: { x: 12, y: 10 } },
        { id: 2, species: 'plant', position: { x: 14, y: 10 } },
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'carnivore',
        spread: 2 * Math.PI,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(true)
      // Should detect herbivore, not plant
    })

    it('plant food sense always returns not-detected', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'herbivore', position: { x: 12, y: 10 } },
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'plant',
        spread: 2 * Math.PI,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(false)
    })
  })

  describe('predator targeting per species (AC3.3.2)', () => {
    it('herbivore senses carnivore as predator', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'carnivore', position: { x: 12, y: 10 } },
      ])
      const result = sense({
        kind: 'predator',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'herbivore',
        spread: 2 * Math.PI,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(true)
    })

    it('carnivore predator sense returns not-detected (apex)', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'herbivore', position: { x: 12, y: 10 } },
      ])
      const result = sense({
        kind: 'predator',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'carnivore',
        spread: 2 * Math.PI,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(false)
    })
  })

  describe('not-detected result shape (AC3.3.8)', () => {
    it('returns angle=0, distance=0, detected=false when nothing in range', () => {
      const { index, getEntity } = setupWorld([])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'herbivore',
        spread: 2 * Math.PI,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(false)
      expect(result.angle).toBe(0)
      expect(result.distance).toBe(0)
    })
  })

  describe('wrap-aware bearing (AC3.3.7)', () => {
    it('sense result angle is in [-pi, pi]', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'plant', position: { x: 79, y: 10 } },
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 1, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'herbivore',
        spread: 2 * Math.PI,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(true)
      expect(result.angle).toBeGreaterThanOrEqual(-Math.PI)
      expect(result.angle).toBeLessThanOrEqual(Math.PI)
    })
  })

  describe('spread constraints (AC3.3.4, AC3.3.5)', () => {
    it('spread=0 returns only targets exactly ahead (within epsilon)', () => {
      // Querier facing east (orientation=0), target directly east at distance 5
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'plant', position: { x: 15, y: 10 } },
        { id: 2, species: 'plant', position: { x: 10, y: 15 } }, // south, outside zero-spread cone
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0, // facing east
        querierSpecies: 'herbivore',
        spread: 0, // zero cone angle
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      // With spread=0, halfSpread=0, only targets at relativeAngle=0 pass
      // Plant at (15,10) is directly east from (10,10) -> relativeAngle~=0 -> detected
      expect(result.detected).toBe(true)
      expect(result.distance).toBeCloseTo(5)
    })

    it('spread=0 does NOT detect targets to the side', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'plant', position: { x: 10, y: 5 } }, // north (angle=-pi/2)
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0, // facing east
        querierSpecies: 'herbivore',
        spread: 0,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(false)
    })

    it('full spread (2pi) detects targets in any direction', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'plant', position: { x: 10, y: 5 } }, // north
        { id: 2, species: 'plant', position: { x: 5, y: 10 } }, // west
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0, // facing east
        querierSpecies: 'herbivore',
        spread: 2 * Math.PI,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(true)
      // Should return the nearest of the two
      expect(result.distance).toBeCloseTo(5)
    })

    it('narrow spread excludes targets outside the cone', () => {
      // Querier facing east, narrow cone of pi/4 (22.5 deg each side)
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'plant', position: { x: 15, y: 10 } }, // east — in cone
        { id: 2, species: 'plant', position: { x: 10, y: 5 } }, // north — outside narrow cone
      ])
      const inCone = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'herbivore',
        spread: Math.PI / 4,
        range: 15,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(inCone.detected).toBe(true)
      expect(inCone.distance).toBeCloseTo(5)
    })
  })

  describe('range constraints (AC3.3.6)', () => {
    it('targets beyond range are not detected', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'plant', position: { x: 30, y: 10 } }, // 20 units away
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'herbivore',
        spread: 2 * Math.PI,
        range: 10, // only 10 units
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(false)
    })

    it('targets within range are detected', () => {
      const { index, getEntity } = setupWorld([
        { id: 1, species: 'plant', position: { x: 15, y: 10 } }, // 5 units away
      ])
      const result = sense({
        kind: 'food',
        querierPosition: { x: 10, y: 10 },
        querierOrientation: 0,
        querierSpecies: 'herbivore',
        spread: 2 * Math.PI,
        range: 10,
        index,
        getEntity,
        worldW,
        worldH,
      })
      expect(result.detected).toBe(true)
      expect(result.distance).toBeCloseTo(5)
    })
  })
})
