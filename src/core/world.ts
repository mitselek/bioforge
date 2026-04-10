/**
 * World geometry: torus topology with wrap-aware distance and angle math.
 *
 * RED-phase stub — implementation in GREEN.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §1.
 */

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export function wrap(v: number, size: number): number {
  throw new Error(`world.wrap: not implemented (v=${String(v)}, size=${String(size)})`)
}

export function wrapPosition(p: Vec2, worldW: number, worldH: number): Vec2 {
  throw new Error(
    `world.wrapPosition: not implemented (x=${String(p.x)}, y=${String(p.y)}, worldW=${String(worldW)}, worldH=${String(worldH)})`,
  )
}

export function wrapDelta(d: number, size: number): number {
  throw new Error(`world.wrapDelta: not implemented (d=${String(d)}, size=${String(size)})`)
}

export function torusDistance(a: Vec2, b: Vec2, worldW: number, worldH: number): number {
  throw new Error(
    `world.torusDistance: not implemented (a=${String(a.x)},${String(a.y)} b=${String(b.x)},${String(b.y)} worldW=${String(worldW)} worldH=${String(worldH)})`,
  )
}
