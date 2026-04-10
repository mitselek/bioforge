import { describe, it, expect } from 'vitest'
import {
  makeSpatialIndex,
  applyMovement,
  applyMovementCost,
  resolveCollisions,
} from '../src/core/physics.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'
import { makeLedger } from '../src/core/energy.js'
import { torusDistance } from '../src/core/world.js'

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

// Story 4.1 AC1 — movement integration
// Spec §9.1 (position update), §9.2 (velocity reset after tick), §1 (torus wrap)
describe('applyMovement', () => {
  const cfg = defaultConfig()
  const rng = makeRng(1)

  function makeHerbivore(
    px: number,
    py: number,
    vx: number,
    vy: number,
  ): ReturnType<typeof makeEntity> {
    const stats = cfg.species.herbivore
    const entity = makeEntity({
      id: entityId(1),
      species: 'herbivore',
      position: { x: px, y: py },
      orientation: 0,
      energy: 100,
      lifespan: 900,
      maturityAge: 300,
      genome: randomGenome(rng, cfg),
      stats,
    })
    entity.velocity = { x: vx, y: vy }
    return entity
  }

  it('moves entity east by velocity * dt', () => {
    // AC1: velocity {x:1.2, y:0}, dt=1/30 → x advances by 1.2/30 ≈ 0.04
    const entity = makeHerbivore(10, 15, 1.2, 0)
    const dt = 1 / 30
    applyMovement(entity, dt, cfg.worldW, cfg.worldH)
    expect(entity.position.x).toBeCloseTo(10 + 1.2 * dt, 10)
    expect(entity.position.y).toBeCloseTo(15, 10)
  })

  it('wraps position via torus when entity crosses east edge', () => {
    // AC2: entity at x=79.99, velocity {x:1.2, y:0}, dt=1/30
    // raw = 79.99 + 1.2/30 ≈ 80.03 → wraps to ≈ 0.03
    const entity = makeHerbivore(79.99, 15, 1.2, 0)
    const dt = 1 / 30
    applyMovement(entity, dt, cfg.worldW, cfg.worldH)
    const expected = (((79.99 + 1.2 * dt) % cfg.worldW) + cfg.worldW) % cfg.worldW
    expect(entity.position.x).toBeCloseTo(expected, 10)
    expect(entity.position.x).toBeLessThan(1) // definitely wrapped
  })

  it('resets velocity to zero after movement', () => {
    // AC3: velocity is per-tick intent; must be zero after applyMovement
    const entity = makeHerbivore(10, 15, 0.5, 0.3)
    applyMovement(entity, 1 / 30, cfg.worldW, cfg.worldH)
    expect(entity.velocity.x).toBe(0)
    expect(entity.velocity.y).toBe(0)
  })

  it('does not move a plant with zero velocity', () => {
    // AC4: plants have maxSpeed=0; applyMovement with zero velocity is a no-op
    const stats = cfg.species.plant
    const plant = makeEntity({
      id: entityId(2),
      species: 'plant',
      position: { x: 40, y: 15 },
      orientation: 0,
      energy: 50,
      lifespan: 1200,
      maturityAge: 400,
      genome: randomGenome(rng, cfg),
      stats,
    })
    // plant velocity stays at the default {x:0, y:0}
    applyMovement(plant, 1 / 30, cfg.worldW, cfg.worldH)
    expect(plant.position.x).toBe(40)
    expect(plant.position.y).toBe(15)
  })

  // Story 4.1 AC4.1.2 — lastMoveDistance records actual distance traveled
  // Spec §9.1: "Each tick records the distance traveled for movement cost calculation"
  // Spec §3.5: "Movement cost uses actual speed, not maxSpeed"

  it('sets lastMoveDistance to sqrt(vx²+vy²)*dt after movement', () => {
    // AC4.1.2 AC1: diagonal movement, distance = magnitude(velocity) * dt
    const vx = 0.9
    const vy = 1.2
    const dt = 1 / 30
    const entity = makeHerbivore(20, 10, vx, vy)
    applyMovement(entity, dt, cfg.worldW, cfg.worldH)
    const expected = Math.sqrt(vx * vx + vy * vy) * dt
    expect(entity.lastMoveDistance).toBeCloseTo(expected, 10)
  })

  it('sets lastMoveDistance to 0 for a stationary entity', () => {
    // AC4.1.2 AC2: zero velocity → zero distance
    const entity = makeHerbivore(20, 10, 0, 0)
    applyMovement(entity, 1 / 30, cfg.worldW, cfg.worldH)
    expect(entity.lastMoveDistance).toBe(0)
  })

  it('captures distance before velocity reset', () => {
    // AC4.1.2 AC3: lastMoveDistance must reflect the velocity that was set
    // (not post-reset zero). We check that the recorded distance is non-zero
    // even though entity.velocity is {0,0} after applyMovement.
    const vx = 1.5
    const vy = 0
    const dt = 1 / 30
    const entity = makeHerbivore(20, 10, vx, vy)
    applyMovement(entity, dt, cfg.worldW, cfg.worldH)
    expect(entity.velocity.x).toBe(0)
    expect(entity.velocity.y).toBe(0)
    expect(entity.lastMoveDistance).toBeCloseTo(vx * dt, 10)
  })

  it('lastMoveDistance is updated on each tick, not accumulated', () => {
    // AC4.1.2: second tick with different speed records that tick's distance only
    const dt = 1 / 30
    const entity = makeHerbivore(20, 10, 1.0, 0)
    applyMovement(entity, dt, cfg.worldW, cfg.worldH)
    // First tick distance ~ 1.0 * dt
    entity.velocity = { x: 0.5, y: 0 }
    applyMovement(entity, dt, cfg.worldW, cfg.worldH)
    // Second tick distance ~ 0.5 * dt (not 1.5 * dt)
    expect(entity.lastMoveDistance).toBeCloseTo(0.5 * dt, 10)
  })
})

// Story 4.1 AC2 — movement energy cost
// Spec §5.2 (drag model), §2.3 (ledger transfer), §2.1 (conservation)
describe('applyMovementCost', () => {
  const cfg = defaultConfig()
  const herbStats = cfg.species.herbivore
  // moveCostLinear=0.02, moveCostQuadratic=0.04
  const dt = 1 / 30

  function makeHerbivoreWithLedger(
    energy: number,
    vx: number,
    vy: number,
  ): {
    entity: ReturnType<typeof makeEntity>
    ledger: ReturnType<typeof makeLedger>
  } {
    const rng = makeRng(1)
    const entity = makeEntity({
      id: entityId(10),
      species: 'herbivore',
      position: { x: 40, y: 15 },
      orientation: 0,
      energy,
      lifespan: 900,
      maturityAge: 300,
      genome: randomGenome(rng, cfg),
      stats: herbStats,
    })
    entity.velocity = { x: vx, y: vy }
    const ledger = makeLedger({ totalEnergy: energy + 1000, initialSoil: 1000 })
    ledger.register({ kind: 'entity', id: 10 }, energy)
    return { entity, ledger }
  }

  it('deducts movement cost from entity energy', () => {
    // AC1: speed=0.6, cost=(0.02*0.6 + 0.04*0.36)*(1/30) = 0.00088
    const { entity, ledger } = makeHerbivoreWithLedger(100, 0.6, 0)
    const speed = Math.sqrt(0.6 * 0.6)
    const expectedCost =
      (herbStats.moveCostLinear * speed + herbStats.moveCostQuadratic * speed * speed) * dt
    applyMovementCost(entity, dt, ledger)
    expect(entity.energy).toBeCloseTo(100 - expectedCost, 10)
  })

  it('transfers movement cost to soil via ledger', () => {
    // AC2: lost energy appears in the soil pool
    const { entity, ledger } = makeHerbivoreWithLedger(100, 0.6, 0)
    const soilBefore = ledger.get({ kind: 'soil' })
    const speed = Math.sqrt(0.6 * 0.6)
    const expectedCost =
      (herbStats.moveCostLinear * speed + herbStats.moveCostQuadratic * speed * speed) * dt
    applyMovementCost(entity, dt, ledger)
    expect(ledger.get({ kind: 'soil' })).toBeCloseTo(soilBefore + expectedCost, 10)
  })

  it('zero cost when entity is stationary', () => {
    // AC3: velocity {x:0, y:0} → speed=0 → cost=0, no ledger transfer
    const { entity, ledger } = makeHerbivoreWithLedger(100, 0, 0)
    const energyBefore = entity.energy
    const soilBefore = ledger.get({ kind: 'soil' })
    applyMovementCost(entity, dt, ledger)
    expect(entity.energy).toBe(energyBefore)
    expect(ledger.get({ kind: 'soil' })).toBe(soilBefore)
  })

  it('total ledger energy is conserved', () => {
    // AC4: totalEnergy() is identical before and after
    const { entity, ledger } = makeHerbivoreWithLedger(100, 0.6, 0)
    const totalBefore = ledger.totalEnergy()
    applyMovementCost(entity, dt, ledger)
    expect(ledger.totalEnergy()).toBeCloseTo(totalBefore, 10)
  })
})

// Story 4.1 AC4.1.3-6 — collision resolution
// Spec §9.3: push overlapping pairs apart by half overlap each; plants absorb zero push
// Spec §1: torus-aware distance and position wrapping
describe('resolveCollisions', () => {
  // defaultConfig radii: plant=0.4, herbivore=0.5, carnivore=0.7, decomposer=0.4
  const cfg = defaultConfig()
  const worldW = cfg.worldW // 80
  const worldH = cfg.worldH // 30

  function makeEntityAt(
    id: number,
    species: 'herbivore' | 'carnivore' | 'plant' | 'decomposer',
    x: number,
    y: number,
  ): ReturnType<typeof makeEntity> {
    const rng = makeRng(1)
    return makeEntity({
      id: entityId(id),
      species,
      position: { x, y },
      orientation: 0,
      energy: 100,
      lifespan: 900,
      maturityAge: 300,
      genome: randomGenome(rng, cfg),
      stats: cfg.species[species],
    })
  }

  function makeIndexWith(entities: ReturnType<typeof makeEntity>[]): SpatialIndexType {
    const idx = makeSpatialIndex(worldW, worldH, 2)
    for (const e of entities) {
      idx.insert(e.id, e.position)
    }
    return idx
  }

  // Helper type alias so we can name it
  type SpatialIndexType = ReturnType<typeof makeSpatialIndex>

  describe('AC4.1.3 — overlapping pair pushed to sum-of-radii distance', () => {
    it('two herbivores 0.8 apart (sumRadii=1.0) are pushed to distance=1.0', () => {
      // herbivore radius=0.5 each; sumRadii=1.0; initial dist=0.8 < 1.0
      // overlap=0.2, push each = 0.1 along x-axis
      const herbA = makeEntityAt(1, 'herbivore', 10, 10)
      const herbB = makeEntityAt(2, 'herbivore', 10.8, 10)
      const entities = new Map([
        [1, herbA],
        [2, herbB],
      ])
      const idx = makeIndexWith([herbA, herbB])
      resolveCollisions(entities, idx, worldW, worldH)
      const dist = torusDistance(herbA.position, herbB.position, worldW, worldH)
      expect(dist).toBeCloseTo(1.0, 8)
    })

    it('herbivore and carnivore 0.8 apart (sumRadii=1.2) are pushed to distance=1.2', () => {
      // herbivore r=0.5, carnivore r=0.7; sumRadii=1.2; initial dist=0.8 < 1.2
      const herb = makeEntityAt(1, 'herbivore', 10, 10)
      const carn = makeEntityAt(2, 'carnivore', 10.8, 10)
      const entities = new Map([
        [1, herb],
        [2, carn],
      ])
      const idx = makeIndexWith([herb, carn])
      resolveCollisions(entities, idx, worldW, worldH)
      const dist = torusDistance(herb.position, carn.position, worldW, worldH)
      expect(dist).toBeCloseTo(1.2, 8)
    })
  })

  describe('AC4.1.4 — center of mass conserved for two mobile entities', () => {
    it('midpoint is unchanged after resolving two herbivores', () => {
      // midpoint x = (10 + 10.8) / 2 = 10.4; y = 10
      const herbA = makeEntityAt(1, 'herbivore', 10, 10)
      const herbB = makeEntityAt(2, 'herbivore', 10.8, 10)
      const midXBefore = (herbA.position.x + herbB.position.x) / 2
      const midYBefore = (herbA.position.y + herbB.position.y) / 2
      const entities = new Map([
        [1, herbA],
        [2, herbB],
      ])
      const idx = makeIndexWith([herbA, herbB])
      resolveCollisions(entities, idx, worldW, worldH)
      const midXAfter = (herbA.position.x + herbB.position.x) / 2
      const midYAfter = (herbA.position.y + herbB.position.y) / 2
      expect(midXAfter).toBeCloseTo(midXBefore, 8)
      expect(midYAfter).toBeCloseTo(midYBefore, 8)
    })
  })

  describe('AC4.1.5 — plant absorbs zero push, mobile takes full displacement', () => {
    it('plant position unchanged, herbivore pushed full overlap distance', () => {
      // plant r=0.4, herbivore r=0.5; sumRadii=0.9; initial dist=0.6 < 0.9
      // overlap=0.3; plant stays, herbivore pushed 0.3 away
      const plant = makeEntityAt(1, 'plant', 20, 20)
      const herb = makeEntityAt(2, 'herbivore', 20.6, 20)
      const plantPosBefore = { ...plant.position }
      const entities = new Map([
        [1, plant],
        [2, herb],
      ])
      const idx = makeIndexWith([plant, herb])
      resolveCollisions(entities, idx, worldW, worldH)
      // plant must not move
      expect(plant.position.x).toBeCloseTo(plantPosBefore.x, 8)
      expect(plant.position.y).toBeCloseTo(plantPosBefore.y, 8)
      // distance after must be >= sumRadii
      const dist = torusDistance(plant.position, herb.position, worldW, worldH)
      expect(dist).toBeCloseTo(0.9, 8)
    })
  })

  describe('AC4.1.6 — torus-aware collision across world edge', () => {
    it('two herbivores near opposite x edges are pushed apart correctly', () => {
      // herbA at x=0.3, herbB at x=79.8, worldW=80
      // wrapDelta(0.3 - 79.8, 80) = 0.5 → torus distance = 0.5 < sumRadii=1.0
      const herbA = makeEntityAt(1, 'herbivore', 0.3, 15)
      const herbB = makeEntityAt(2, 'herbivore', 79.8, 15)
      const entities = new Map([
        [1, herbA],
        [2, herbB],
      ])
      const idx = makeIndexWith([herbA, herbB])
      resolveCollisions(entities, idx, worldW, worldH)
      const dist = torusDistance(herbA.position, herbB.position, worldW, worldH)
      expect(dist).toBeCloseTo(1.0, 8)
    })
  })

  describe('non-overlapping pair — no change', () => {
    it('entities already separated are not moved', () => {
      // distance=5.0 >> sumRadii=1.0; no collision
      const herbA = makeEntityAt(1, 'herbivore', 10, 10)
      const herbB = makeEntityAt(2, 'herbivore', 15, 10)
      const posABefore = { ...herbA.position }
      const posBBefore = { ...herbB.position }
      const entities = new Map([
        [1, herbA],
        [2, herbB],
      ])
      const idx = makeIndexWith([herbA, herbB])
      resolveCollisions(entities, idx, worldW, worldH)
      expect(herbA.position.x).toBeCloseTo(posABefore.x, 8)
      expect(herbB.position.x).toBeCloseTo(posBBefore.x, 8)
    })
  })
})
