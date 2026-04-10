/**
 * BioForge configuration: tunable constants and per-species defaults.
 *
 * `defaultConfig()` returns the canonical starting configuration. All
 * values are traceable to the design spec; see the citations below.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §3.6 (per-species
 * stats), §15.2 (tunables), §17 (initial seeding budget).
 */

export type Species = 'plant' | 'herbivore' | 'carnivore' | 'decomposer'

export interface SpeciesStats {
  readonly radius: number
  readonly maxSpeed: number
  readonly baseMetabolicRate: number
  readonly moveCostLinear: number
  readonly moveCostQuadratic: number
  readonly eatRate: number
  readonly absorbRate: number
  readonly efficiency: number
  readonly lifespanMean: number
  readonly lifespanStddev: number
  readonly maturityAgeMean: number
  readonly maturityAgeStddev: number
  readonly reproThresholdEnergy: number
  readonly reproCostFraction: number
  readonly initialEnergy: number
  readonly maxSenseRange: number
}

export interface MutationRates {
  readonly argDrift: number
  readonly argDriftSigma: number
  readonly opSwap: number
  readonly insert: number
  readonly delete: number
  readonly statDrift: number
  readonly statDriftSigma: number
}

export interface Config {
  readonly seed: number
  readonly totalEnergy: number
  readonly worldW: number
  readonly worldH: number
  readonly baseHz: number
  readonly poopThreshold: number
  readonly corpseDecayRate: number
  readonly poopDecayRate: number
  readonly minReproWindow: number
  readonly reproCooldownTicks: number
  readonly compostRadius: number
  readonly compostBoost: number
  readonly compostBoostCap: number
  readonly compostSpawnRadius: number
  readonly plantSpawnBaseProb: number
  readonly minTapeLength: number
  readonly maxTapeLength: number
  readonly initialTapeLengthMin: number
  readonly initialTapeLengthMax: number
  readonly turnRate: number
  readonly autoSpawnPlants: boolean
  readonly energyEpsilon: number
  readonly mutationRates: MutationRates
  readonly species: Readonly<Record<Species, SpeciesStats>>
  readonly initialCounts: Readonly<Record<Species, number>>
}

export function defaultConfig(): Config {
  const plant: SpeciesStats = {
    radius: 0.4,
    maxSpeed: 0,
    baseMetabolicRate: 0.01,
    moveCostLinear: 0,
    moveCostQuadratic: 0,
    eatRate: 0,
    absorbRate: 2.0,
    efficiency: 0,
    lifespanMean: 1200,
    lifespanStddev: 100,
    maturityAgeMean: 400,
    maturityAgeStddev: 40,
    reproThresholdEnergy: 0,
    reproCostFraction: 0,
    initialEnergy: 50,
    maxSenseRange: 0,
  }
  const herbivore: SpeciesStats = {
    radius: 0.5,
    maxSpeed: 1.2,
    baseMetabolicRate: 0.05,
    moveCostLinear: 0.02,
    moveCostQuadratic: 0.04,
    eatRate: 5.0,
    absorbRate: 0,
    efficiency: 0.7,
    lifespanMean: 900,
    lifespanStddev: 80,
    maturityAgeMean: 300,
    maturityAgeStddev: 30,
    reproThresholdEnergy: 150,
    reproCostFraction: 0.5,
    initialEnergy: 100,
    maxSenseRange: 12,
  }
  const carnivore: SpeciesStats = {
    radius: 0.7,
    maxSpeed: 1.8,
    baseMetabolicRate: 0.1,
    moveCostLinear: 0.03,
    moveCostQuadratic: 0.06,
    eatRate: 10000,
    absorbRate: 0,
    efficiency: 0.6,
    lifespanMean: 1500,
    lifespanStddev: 120,
    maturityAgeMean: 500,
    maturityAgeStddev: 50,
    reproThresholdEnergy: 250,
    reproCostFraction: 0.5,
    initialEnergy: 200,
    maxSenseRange: 15,
  }
  const decomposer: SpeciesStats = {
    radius: 0.4,
    maxSpeed: 0.8,
    baseMetabolicRate: 0.02,
    moveCostLinear: 0.02,
    moveCostQuadratic: 0.03,
    eatRate: 1.67,
    absorbRate: 0,
    efficiency: 0.9,
    lifespanMean: 1000,
    lifespanStddev: 90,
    maturityAgeMean: 300,
    maturityAgeStddev: 30,
    reproThresholdEnergy: 100,
    reproCostFraction: 0.5,
    initialEnergy: 80,
    maxSenseRange: 10,
  }

  return {
    seed: 42,
    totalEnergy: 100_000,
    worldW: 80,
    worldH: 30,
    baseHz: 30,
    poopThreshold: 10,
    corpseDecayRate: 1.0,
    poopDecayRate: 0,
    minReproWindow: 100,
    reproCooldownTicks: 200,
    compostRadius: 3,
    compostBoost: 0.5,
    compostBoostCap: 3.0,
    compostSpawnRadius: 2,
    plantSpawnBaseProb: 0.002,
    minTapeLength: 2,
    maxTapeLength: 64,
    initialTapeLengthMin: 6,
    initialTapeLengthMax: 16,
    turnRate: Math.PI,
    autoSpawnPlants: true,
    energyEpsilon: 1e-6,
    mutationRates: {
      argDrift: 0.1,
      argDriftSigma: 0.05,
      opSwap: 0.05,
      insert: 0.03,
      delete: 0.03,
      statDrift: 0.05,
      statDriftSigma: 0.1,
    },
    species: { plant, herbivore, carnivore, decomposer },
    initialCounts: { plant: 250, herbivore: 100, carnivore: 40, decomposer: 50 },
  }
}
