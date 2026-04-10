/**
 * Entity type and factory.
 *
 * Defines the shared shape that all four species (plant, herbivore,
 * carnivore, decomposer) use. The species discriminator + per-species
 * stats from config provide the differentiation.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §3, §6.1.
 */

import type { Vec2 } from './world.js'
import type { Species, SpeciesStats } from './config.js'
import type { Genome } from './genome.js'

// Branded numeric IDs. The brand prevents accidentally mixing entity ids
// with corpse/poop/compost ids at the type level.
declare const EntityIdBrand: unique symbol
export type EntityId = number & { readonly [EntityIdBrand]: 'EntityId' }

export function entityId(n: number): EntityId {
  return n as EntityId
}

// Initial sense result for newly-born entities. The genome VM's
// JUMP_IF_* instructions read lastSense; this is the safe default
// before any SENSE_* instruction has run.
export interface SenseResult {
  readonly kind: 'food' | 'predator' | 'mate'
  readonly angle: number
  readonly distance: number
  readonly detected: boolean
  readonly spread: number
  readonly range: number
}

export const NO_SENSE: SenseResult = {
  kind: 'food',
  angle: 0,
  distance: 0,
  detected: false,
  spread: 0,
  range: 0,
}

export interface Entity {
  id: EntityId
  species: Species
  position: Vec2
  velocity: Vec2
  orientation: number
  energy: number
  wasteBuffer: number
  age: number
  lifespan: number
  maturityAge: number
  lastReproTick: number
  genome: Genome
  lastSense: SenseResult
  stats: SpeciesStats
}

export interface MakeEntityArgs {
  readonly id: EntityId
  readonly species: Species
  readonly position: Vec2
  readonly orientation: number
  readonly energy: number
  readonly lifespan: number
  readonly maturityAge: number
  readonly genome: Genome
  readonly stats: SpeciesStats
  readonly age?: number
}

export function makeEntity(args: MakeEntityArgs): Entity {
  return {
    id: args.id,
    species: args.species,
    position: args.position,
    velocity: { x: 0, y: 0 },
    orientation: args.orientation,
    energy: args.energy,
    wasteBuffer: 0,
    age: args.age ?? 0,
    lifespan: args.lifespan,
    maturityAge: args.maturityAge,
    lastReproTick: Number.NEGATIVE_INFINITY,
    genome: args.genome,
    lastSense: NO_SENSE,
    stats: args.stats,
  }
}
