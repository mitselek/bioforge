/**
 * Seeded pseudo-random number generator.
 *
 * RED-phase stub: type surface only, implementation in GREEN.
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §11, §16.
 */

export interface Rng {
  float(): number
}

export function makeRng(seed: number): Rng {
  throw new Error(`rng: not implemented (seed=${String(seed)})`)
}
