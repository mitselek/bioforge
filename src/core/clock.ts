/**
 * Fixed-timestep simulation clock.
 *
 * RED-phase stub — implementation in GREEN.
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §10, §15.2.
 */

export interface ClockOptions {
  readonly baseHz: number
}

export interface Clock {
  readonly baseHz: number
  speed: number
  readonly dt: number
  readonly tick: number
  paused: boolean
  advance(): void
  reset(): void
}

export function makeClock(opts: ClockOptions): Clock {
  throw new Error(`clock: not implemented (baseHz=${String(opts.baseHz)})`)
}
