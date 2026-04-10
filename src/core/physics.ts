/**
 * Physics: spatial index, movement integration, collisions.
 *
 * Story 3.2 implements the spatial index only. Movement and collisions
 * come in Story 4.1.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §9.4.
 */

import { wrap } from './world.js'
import type { Entity } from './entity.js'

export interface SpatialIndex {
  insert(id: number, position: { readonly x: number; readonly y: number }): void
  clear(): void
  queryRadius(center: { readonly x: number; readonly y: number }, radius: number): Iterable<number>
}

/**
 * Apply one tick of movement to an entity.
 *
 * Integrates velocity into position (torus-wrapped), then resets velocity to
 * zero. Velocity is per-tick intent set by the genome VM; if MOVE_FORWARD was
 * not executed this tick the entity stays still.
 *
 * Story 4.1 AC1. Spec §9.1, §9.2, §1.2.
 *
 * @stub — implementation pending GREEN phase
 */
export function applyMovement(entity: Entity, dt: number, worldW: number, worldH: number): void {
  const newX = wrap(entity.position.x + entity.velocity.x * dt, worldW)
  const newY = wrap(entity.position.y + entity.velocity.y * dt, worldH)
  entity.position = { x: newX, y: newY }
  entity.velocity = { x: 0, y: 0 }
}

export function makeSpatialIndex(worldW: number, worldH: number, cellSize: number): SpatialIndex {
  const cols = Math.ceil(worldW / cellSize)
  const rows = Math.ceil(worldH / cellSize)
  const cells: number[][] = []
  for (let i = 0; i < cols * rows; i++) {
    cells.push([])
  }

  const cellIndex = (x: number, y: number): number => {
    const col = Math.floor(wrap(x, worldW) / cellSize) % cols
    const row = Math.floor(wrap(y, worldH) / cellSize) % rows
    return row * cols + col
  }

  return {
    insert(id: number, position: { readonly x: number; readonly y: number }): void {
      const idx = cellIndex(position.x, position.y)
      cells[idx]?.push(id)
    },
    clear(): void {
      for (const cell of cells) {
        cell.length = 0
      }
    },
    *queryRadius(
      center: { readonly x: number; readonly y: number },
      radius: number,
    ): Generator<number> {
      const cellSpan = Math.ceil(radius / cellSize)
      const centerCol = Math.floor(wrap(center.x, worldW) / cellSize) % cols
      const centerRow = Math.floor(wrap(center.y, worldH) / cellSize) % rows

      for (let dy = -cellSpan; dy <= cellSpan; dy++) {
        for (let dx = -cellSpan; dx <= cellSpan; dx++) {
          const col = (((centerCol + dx) % cols) + cols) % cols
          const row = (((centerRow + dy) % rows) + rows) % rows
          const cell = cells[row * cols + col]
          if (cell !== undefined) {
            for (const id of cell) {
              yield id
            }
          }
        }
      }
    },
  }
}
