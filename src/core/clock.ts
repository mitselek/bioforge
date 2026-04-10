/**
 * Fixed-timestep simulation clock.
 *
 * dt = speed / baseHz. Speed is clamped to [MIN_SPEED, MAX_SPEED] and
 * guarded against non-finite values per spec §15.2.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §10, §15.2.
 */

const MIN_SPEED = 0.1
const MAX_SPEED = 10
const DEFAULT_SPEED = 1.0

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
  if (!Number.isFinite(opts.baseHz) || opts.baseHz <= 0) {
    throw new Error(`clock: invalid baseHz ${String(opts.baseHz)}`)
  }
  const baseHz = opts.baseHz
  let speed = DEFAULT_SPEED
  let tick = 0
  let paused = false

  return {
    baseHz,
    get speed(): number {
      return speed
    },
    set speed(v: number) {
      if (!Number.isFinite(v)) {
        speed = DEFAULT_SPEED
        return
      }
      if (v < MIN_SPEED) {
        speed = MIN_SPEED
      } else if (v > MAX_SPEED) {
        speed = MAX_SPEED
      } else {
        speed = v
      }
    },
    get dt(): number {
      return speed / baseHz
    },
    get tick(): number {
      return tick
    },
    get paused(): boolean {
      return paused
    },
    set paused(v: boolean) {
      paused = v
    },
    advance(): void {
      if (!paused) {
        tick += 1
      }
    },
    reset(): void {
      tick = 0
      speed = DEFAULT_SPEED
      paused = false
    },
  }
}
