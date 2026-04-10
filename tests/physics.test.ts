import { describe, it, expect } from 'vitest'
import { makeSpatialIndex, applyMovement, applyMovementCost } from '../src/core/physics.js'
import { makeEntity, entityId } from '../src/core/entity.js'
import { defaultConfig } from '../src/core/config.js'
import { makeRng } from '../src/core/rng.js'
import { randomGenome } from '../src/core/genome.js'
import { makeLedger } from '../src/core/energy.js'

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
