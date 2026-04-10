/**
 * Sim: top-level simulation container.
 *
 * `makeSim(cfg, rng)` seeds the world with entities per species, registers all
 * pools in the energy ledger, and exposes a `tick()` method and a read-only
 * `state` snapshot.
 *
 * Story 5.1 implements AC5.1.1-3.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §10, §17, §2.
 */

import type { Config } from './config.js'
import type { Rng } from './rng.js'
import type { Entity } from './entity.js'
import type { Ledger } from './energy.js'
import type { DeadMatterRegistry } from './deadMatter.js'
import type { SpatialIndex } from './physics.js'

export interface SimState {
  readonly tick: number
  readonly entities: ReadonlyMap<number, Entity>
}

export interface Sim {
  tick(): void
  assertEnergyConserved(): void
  readonly state: SimState
}

/**
 * Create a new simulation seeded from `cfg` using `rng` for all stochastic
 * decisions. Stub implementation — throws on `tick()`.
 *
 * Story 5.1 AC5.1.1-3. Spec §10, §17, §2.
 */
export function makeSim(cfg: Config, rng: Rng): Sim {
  throw new Error(`makeSim not implemented: cfg.seed=${String(cfg.seed)} rng=${typeof rng}`)
}

// Re-export internal types so tests can reference them without reaching into
// implementation modules directly through sim. These are the types the Sim
// owns at runtime.
export type { Ledger, DeadMatterRegistry, SpatialIndex }
