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

import { defaultConfig } from './core/config.js'
import type { Config } from './core/config.js'
import { makeSim } from './core/sim.js'
import type { Sim } from './core/sim.js'
import { makeClock } from './core/clock.js'
import type { Clock } from './core/clock.js'
import { makeRng } from './core/rng.js'
import type { Entity } from './core/entity.js'

/** Multiplicative speed step used by speedUp/speedDown. */
const SPEED_STEP = 1.5

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
 * Initialise the application: create sim + clock, wire control callbacks.
 * Returns an AppHandle suitable for both programmatic testing and live UI use.
 *
 * The blessed screen is created only when the process has a TTY (`process.stdout.isTTY`).
 * In test environments the screen is skipped, so tests run headlessly.
 *
 * Story 7.1 AC7.1.1-6. Spec §10, §14, §15.
 */
export function startApp(cfg?: Config): AppHandle {
  const resolvedCfg = cfg ?? defaultConfig()
  const rng = makeRng(resolvedCfg.seed)
  const sim = makeSim(resolvedCfg, rng)
  const clock = makeClock({ baseHz: resolvedCfg.baseHz })

  let selectedEntity: Entity | undefined = undefined
  let destroyed = false

  // Only create a blessed screen in a real TTY context.
  let screen: { destroy(): void } | undefined
  if (process.stdout.isTTY) {
    // Lazy require to avoid crashing in headless test environments.
    // blessed opens /dev/tty directly and will crash if no TTY is available.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const blessed = require('blessed') as {
        screen(opts: Record<string, unknown>): { destroy(): void }
      }
      screen = blessed.screen({ smartCSR: true, title: 'BioForge', fullUnicode: true })
    } catch {
      // No TTY or blessed unavailable — headless mode
      screen = undefined
    }
  }

  return {
    get sim(): Sim {
      return sim
    },
    get clock(): Clock {
      return clock
    },
    get selectedEntity(): Entity | undefined {
      return selectedEntity
    },
    pause(): void {
      clock.paused = true
    },
    resume(): void {
      clock.paused = false
    },
    togglePause(): void {
      clock.paused = !clock.paused
    },
    speedDown(): void {
      clock.speed = clock.speed / SPEED_STEP
    },
    speedUp(): void {
      clock.speed = clock.speed * SPEED_STEP
    },
    selectEntity(id: number): void {
      selectedEntity = sim.state.entities.get(id)
    },
    quit(): void {
      if (destroyed) return
      destroyed = true
      if (screen !== undefined) {
        try {
          screen.destroy()
        } catch {
          // Ignore errors on destroy — screen may already be gone
        }
      }
    },
    resetSim(): void {
      sim.reset()
      clock.reset()
      selectedEntity = undefined
    },
  }
}
