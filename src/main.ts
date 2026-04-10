/**
 * BioForge main entry point.
 *
 * `startApp(cfg?)` initialises the simulation and UI, wires keyboard input
 * to the clock/sim control callbacks, and returns an AppHandle for testing
 * and programmatic control.
 *
 * Story 7.1 implements AC7.1.1-6.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §10, §14, §15.
 */

import type { Config } from './core/config.js'
import type { Sim } from './core/sim.js'
import type { Clock } from './core/clock.js'
import type { Entity } from './core/entity.js'

/** Control handle returned by startApp. */
export interface AppHandle {
  /** The underlying simulation instance. */
  readonly sim: Sim
  /** The clock governing tick rate and pause state. */
  readonly clock: Clock
  /** Pause the simulation. */
  pause(): void
  /** Resume the simulation. */
  resume(): void
  /** Toggle pause/resume. */
  togglePause(): void
  /** Decrease clock speed one step. */
  speedDown(): void
  /** Increase clock speed one step. */
  speedUp(): void
  /** Select an entity by ID for inspector display. */
  selectEntity(id: number): void
  /** Return the currently selected entity, or undefined. */
  readonly selectedEntity: Entity | undefined
  /** Trigger application quit (destroys screen and stops the loop). */
  quit(): void
  /** Reset the simulation to its initial state. */
  resetSim(): void
}

/**
 * Initialise the application: create sim + clock, wire UI callbacks.
 * Stub implementation — throws 'startApp not implemented'.
 *
 * Story 7.1 AC7.1.1-6. Spec §10, §14, §15.
 */
export function startApp(cfg?: Config): AppHandle {
  throw new Error(`startApp not implemented: cfg=${String(cfg?.seed ?? 'default')}`)
}
