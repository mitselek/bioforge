/**
 * Physics: spatial index, movement integration, collisions.
 *
 * Story 3.2 implements the spatial index only. Movement and collisions
 * come in Story 4.1.
 *
 * RED-phase stub — implementation in GREEN.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §9.4.
 */

export interface SpatialIndex {
  insert(id: number, position: { readonly x: number; readonly y: number }): void
  clear(): void
  queryRadius(center: { readonly x: number; readonly y: number }, radius: number): Iterable<number>
}

export function makeSpatialIndex(worldW: number, worldH: number, cellSize: number): SpatialIndex {
  throw new Error(
    `physics.makeSpatialIndex: not implemented (worldW=${String(worldW)} worldH=${String(worldH)} cellSize=${String(cellSize)})`,
  )
}
