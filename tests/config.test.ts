import { describe, it, expect } from 'vitest'
import { defaultConfig } from '../src/core/config.js'

describe('config', () => {
  describe('defaultConfig', () => {
    it('has totalEnergy 100_000', () => {
      const cfg = defaultConfig()
      expect(cfg.totalEnergy).toBe(100_000)
    })

    it('has world dimensions 80 x 30', () => {
      const cfg = defaultConfig()
      expect(cfg.worldW).toBe(80)
      expect(cfg.worldH).toBe(30)
    })

    it('has the correct initial species counts', () => {
      const cfg = defaultConfig()
      expect(cfg.initialCounts.plant).toBe(250)
      expect(cfg.initialCounts.herbivore).toBe(100)
      expect(cfg.initialCounts.carnivore).toBe(40)
      expect(cfg.initialCounts.decomposer).toBe(50)
    })

    it('initial living energy budget fits within totalEnergy', () => {
      const cfg = defaultConfig()
      const living =
        cfg.initialCounts.plant * cfg.species.plant.initialEnergy +
        cfg.initialCounts.herbivore * cfg.species.herbivore.initialEnergy +
        cfg.initialCounts.carnivore * cfg.species.carnivore.initialEnergy +
        cfg.initialCounts.decomposer * cfg.species.decomposer.initialEnergy
      expect(living).toBeLessThanOrEqual(cfg.totalEnergy)
    })

    it('every species has all required stats', () => {
      const cfg = defaultConfig()
      for (const species of ['plant', 'herbivore', 'carnivore', 'decomposer'] as const) {
        const stats = cfg.species[species]
        expect(stats.radius).toBeGreaterThan(0)
        expect(stats.baseMetabolicRate).toBeGreaterThanOrEqual(0)
        expect(stats.moveCostLinear).toBeGreaterThanOrEqual(0)
        expect(stats.moveCostQuadratic).toBeGreaterThanOrEqual(0)
        expect(stats.lifespanMean).toBeGreaterThan(0)
        expect(stats.maturityAgeMean).toBeGreaterThan(0)
        expect(stats.maturityAgeMean).toBeLessThan(stats.lifespanMean)
        expect(stats.initialEnergy).toBeGreaterThan(0)
      }
    })

    it('plant maxSpeed is 0 (plants do not move per spec §3.1)', () => {
      const cfg = defaultConfig()
      expect(cfg.species.plant.maxSpeed).toBe(0)
    })
  })
})
