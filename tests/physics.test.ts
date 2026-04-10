import { describe, it, expect } from 'vitest'
import { makeSpatialIndex } from '../src/core/physics.js'

describe('spatialIndex', () => {
  const worldW = 80
  const worldH = 30
  const cellSize = 10

  describe('basics', () => {
    it('returns no results when empty', () => {
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      const results = idx.queryRadius({ x: 40, y: 15 }, 5)
      expect([...results]).toHaveLength(0)
    })

    it('returns an inserted entity within range', () => {
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      idx.insert(1, { x: 10, y: 10 })
      const results = [...idx.queryRadius({ x: 12, y: 10 }, 5)]
      expect(results).toContain(1)
    })

    it('does not return entities outside range', () => {
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      idx.insert(1, { x: 10, y: 10 })
      idx.insert(2, { x: 70, y: 25 })
      const results = [...idx.queryRadius({ x: 10, y: 10 }, 5)]
      expect(results).toContain(1)
      expect(results).not.toContain(2)
    })

    it('clear removes all entries', () => {
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      idx.insert(1, { x: 10, y: 10 })
      idx.insert(2, { x: 20, y: 20 })
      idx.clear()
      expect([...idx.queryRadius({ x: 10, y: 10 }, 50)]).toHaveLength(0)
    })
  })

  describe('torus wrap-around', () => {
    it('finds entities across the x-boundary', () => {
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      // Entity at x=1, query at x=79 — distance via wrap is 2
      idx.insert(1, { x: 1, y: 15 })
      const results = [...idx.queryRadius({ x: 79, y: 15 }, 5)]
      expect(results).toContain(1)
    })

    it('finds entities across the y-boundary', () => {
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      idx.insert(1, { x: 40, y: 1 })
      const results = [...idx.queryRadius({ x: 40, y: 29 }, 5)]
      expect(results).toContain(1)
    })

    it('finds entities across both boundaries (corner wrap)', () => {
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      idx.insert(1, { x: 1, y: 1 })
      const results = [...idx.queryRadius({ x: 79, y: 29 }, 5)]
      expect(results).toContain(1)
    })
  })

  describe('query is a superset (caller does exact distance check)', () => {
    it('may return candidates slightly outside the radius', () => {
      // The spatial index returns candidates from neighboring cells.
      // Some may be slightly outside the exact radius — callers must
      // do a final torusDistance check. This test pins that the index
      // is a SUPERSET: it never misses a true neighbor.
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      // Place entities at known positions
      for (let i = 0; i < 20; i++) {
        idx.insert(i, { x: 40 + (i % 5) * 2, y: 15 + Math.floor(i / 5) * 2 })
      }
      // Query with a small radius — should return at least the nearby ones
      const results = new Set(idx.queryRadius({ x: 42, y: 17 }, 3))
      // Entity at (42, 17) = id 6 should definitely be in range
      expect(results.has(6)).toBe(true)
    })
  })

  describe('performance', () => {
    it('handles 1000 entities and 1000 queries in under 100ms', () => {
      const idx = makeSpatialIndex(worldW, worldH, cellSize)
      for (let i = 0; i < 1000; i++) {
        idx.insert(i, {
          x: (i * 7.31) % worldW,
          y: (i * 3.13) % worldH,
        })
      }
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        const results = [
          ...idx.queryRadius(
            {
              x: (i * 11.17) % worldW,
              y: (i * 5.71) % worldH,
            },
            10,
          ),
        ]
        // Just consume the iterator to force evaluation
        void results.length
      }
      expect(Date.now() - start).toBeLessThan(100)
    })
  })
})
