/**
 * BioForge configuration: tunable constants and per-species defaults.
 *
 * RED-phase stub — defaultConfig throws; types are complete so the test
 * file compiles.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §3.6, §15.2, §17.
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
  throw new Error('config.defaultConfig: not implemented')
}
