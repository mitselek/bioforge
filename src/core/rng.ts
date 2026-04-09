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
  gaussian(mean: number, stddev: number): number
  pick<T>(arr: readonly T[]): T
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0
  const float = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    float,
    floatInRange(a: number, b: number): number {
      return a + float() * (b - a)
    },
    intInRange(a: number, b: number): number {
      return Math.floor(a + float() * (b - a + 1))
    },
    gaussian(mean: number, stddev: number): number {
      // Box-Muller transform. Discard the second sample for simplicity.
      let u = 0
      let v = 0
      while (u === 0) u = float()
      while (v === 0) v = float()
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      return mean + z * stddev
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) {
        throw new Error('rng.pick: empty array')
      }
      const idx = Math.floor(float() * arr.length)
      const value = arr[idx]
      if (value === undefined) {
        throw new Error(`rng.pick: unexpected undefined at index ${String(idx)}`)
      }
      return value
    },
  }
}
