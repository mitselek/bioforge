/**
 * Seeded pseudo-random number generator using mulberry32.
 *
 * Deterministic: same seed → same sequence. Fast, small state, good
 * distribution quality for simulation use (not cryptographic).
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §11 (module
 * layout) and §16 (testing strategy — "seeded PRNG for everything
 * stochastic").
 */

export interface Rng {
  float(): number
  floatInRange(a: number, b: number): number
  intInRange(a: number, b: number): number
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0
  return {
    float(): number {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    floatInRange(a: number, b: number): number {
      throw new Error(`rng.floatInRange: not implemented (a=${String(a)}, b=${String(b)})`)
    },
    intInRange(a: number, b: number): number {
      throw new Error(`rng.intInRange: not implemented (a=${String(a)}, b=${String(b)})`)
    },
  }
}
