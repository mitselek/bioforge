import { describe, it, expect } from 'vitest'
import { defaultConfig, makeConfig } from '../src/core/config.js'

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

  describe('makeConfig', () => {
    it('returns the default config when called with no overrides', () => {
      const cfg = makeConfig()
      const def = defaultConfig()
      expect(cfg.totalEnergy).toBe(def.totalEnergy)
      expect(cfg.worldW).toBe(def.worldW)
      expect(cfg.species.plant.radius).toBe(def.species.plant.radius)
    })

    it('merges top-level overrides onto defaults', () => {
      const cfg = makeConfig({ seed: 999, worldW: 120 })
      expect(cfg.seed).toBe(999)
      expect(cfg.worldW).toBe(120)
      expect(cfg.worldH).toBe(30) // untouched
      expect(cfg.totalEnergy).toBe(100_000) // untouched
    })

    it('deep-merges species overrides without losing other fields', () => {
      const cfg = makeConfig({
        species: {
          plant: defaultConfig().species.plant,
          herbivore: { ...defaultConfig().species.herbivore, maxSpeed: 3.0 },
          carnivore: defaultConfig().species.carnivore,
          decomposer: defaultConfig().species.decomposer,
        },
      })
      expect(cfg.species.herbivore.maxSpeed).toBe(3.0)
      expect(cfg.species.herbivore.radius).toBe(0.5) // from default
      expect(cfg.species.carnivore.maxSpeed).toBe(1.8) // untouched
      expect(cfg.species.plant.maxSpeed).toBe(0) // untouched
    })

    it('overrides initialCounts independently', () => {
      const cfg = makeConfig({
        initialCounts: { plant: 500, herbivore: 100, carnivore: 40, decomposer: 50 },
      })
      expect(cfg.initialCounts.plant).toBe(500)
      expect(cfg.initialCounts.herbivore).toBe(100) // unchanged
    })

    it('overrides mutationRates independently', () => {
      const cfg = makeConfig({
        mutationRates: {
          argDrift: 0.2,
          argDriftSigma: 0.05,
          opSwap: 0.05,
          insert: 0.03,
          delete: 0.03,
          statDrift: 0.05,
          statDriftSigma: 0.1,
        },
      })
      expect(cfg.mutationRates.argDrift).toBe(0.2)
      expect(cfg.mutationRates.opSwap).toBe(0.05)
    })
  })

  describe('plant inert sentinels', () => {
    // Per scratchpad [PATTERN] "Inert sentinel values": plants never reach
    // movement, eating, or sensing code paths in practice. The fields are
    // present on SpeciesStats for type-uniformity but should be set to
    // values that produce the LOUDEST FAILURE (not silent corruption) if
    // accidentally routed through the consuming code paths.
    //
    // Verified by purple in Story 1.3 Cycle 1 PURPLE that with the loss-form
    // unified eat in spec §3.5 (loss = amount * (1 - efficiency)), efficiency=0
    // routes all energy to wasteBuffer and would produce visible poop-at-plant
    // — a loud failure rather than silent free energy.

    it('plant.maxSpeed is 0 (no movement, spec §3.1)', () => {
      expect(defaultConfig().species.plant.maxSpeed).toBe(0)
    })

    it('plant.eatRate is 0 (no eating, spec §3.1)', () => {
      expect(defaultConfig().species.plant.eatRate).toBe(0)
    })

    it('plant.efficiency is 0 (loud failure on accidental eat-route)', () => {
      expect(defaultConfig().species.plant.efficiency).toBe(0)
    })

    it('plant.maxSenseRange is 0 (sensing always returns not-detected, spec §7.5)', () => {
      expect(defaultConfig().species.plant.maxSenseRange).toBe(0)
    })

    it('plant.reproThresholdEnergy is 0 (no standard reproduction, spec §6.3)', () => {
      expect(defaultConfig().species.plant.reproThresholdEnergy).toBe(0)
    })

    it('plant.reproCostFraction is 0 (no standard reproduction, spec §6.3)', () => {
      expect(defaultConfig().species.plant.reproCostFraction).toBe(0)
    })
  })
})
