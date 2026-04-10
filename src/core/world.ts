/**
 * World geometry: torus topology with wrap-aware distance and angle math.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §1.
 */

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export function wrap(v: number, size: number): number {
  return ((v % size) + size) % size
}

export function wrapPosition(p: Vec2, worldW: number, worldH: number): Vec2 {
  return { x: wrap(p.x, worldW), y: wrap(p.y, worldH) }
}

export function wrapDelta(d: number, size: number): number {
  return d - Math.round(d / size) * size
}

export function torusDistance(a: Vec2, b: Vec2, worldW: number, worldH: number): number {
  const dx = wrapDelta(a.x - b.x, worldW)
  const dy = wrapDelta(a.y - b.y, worldH)
  return Math.sqrt(dx * dx + dy * dy)
}

export function torusBearing(from: Vec2, to: Vec2, worldW: number, worldH: number): number {
  const dx = wrapDelta(to.x - from.x, worldW)
  const dy = wrapDelta(to.y - from.y, worldH)
  return Math.atan2(dy, dx)
}

export function normalizeAngle(a: number): number {
  // JS `%` is sign-preserving (a - trunc(a/TAU)*TAU), so r ∈ (-TAU, TAU).
  // At the ±π boundary the sign of `a` is preserved, which is what the tests
  // pin: normalizeAngle(3π) === +π and normalizeAngle(-3π) === -π.
  // Spec §1.3 forbids `while`-loop normalization because it freezes on huge
  // inputs; the single `%` + at-most-one branch runs in constant time.
  const TAU = 2 * Math.PI
  let r = a % TAU
  if (r > Math.PI) r -= TAU
  else if (r < -Math.PI) r += TAU
  return r
}
