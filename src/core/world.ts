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
