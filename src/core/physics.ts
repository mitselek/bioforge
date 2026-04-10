/**
 * Physics: spatial index, movement integration, collisions.
 *
 * Story 3.2 implements the spatial index. Story 4.1 adds movement
 * integration, movement cost, and collision resolution.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §9.4.
 */

import { wrap, wrapDelta, wrapPosition, torusDistance } from './world.js'
import type { Entity } from './entity.js'
import type { Ledger } from './energy.js'

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
 */
export function applyMovement(entity: Entity, dt: number, worldW: number, worldH: number): void {
  const { x, y } = entity.velocity
  entity.lastMoveDistance = Math.sqrt(x * x + y * y) * dt
  const newX = wrap(entity.position.x + x * dt, worldW)
  const newY = wrap(entity.position.y + y * dt, worldH)
  entity.position = { x: newX, y: newY }
  entity.velocity = { x: 0, y: 0 }
}

/**
 * Deduct the per-tick movement cost from an entity and transfer it to soil via
 * the ledger. Must be called BEFORE applyMovement so that velocity (and
 * therefore speed) is still set from the VM step.
 *
 * cost = (moveCostLinear * speed + moveCostQuadratic * speed²) * dt
 *
 * Story 4.1 AC2. Spec §5.2, §2.3.
 */
export function applyMovementCost(entity: Entity, dt: number, ledger: Ledger): void {
  const { x, y } = entity.velocity
  const speed = Math.sqrt(x * x + y * y)
  if (speed === 0) return
  const cost =
    (entity.stats.moveCostLinear * speed + entity.stats.moveCostQuadratic * speed * speed) * dt
  ledger.transfer({ kind: 'entity', id: entity.id }, { kind: 'soil' }, cost)
  entity.energy -= cost
}

/**
 * Resolve collisions between overlapping entity pairs.
 *
 * For each pair where torus-distance < r1 + r2, push them apart along the
 * connecting vector by (r1+r2-distance)/2 each. Plants absorb zero push —
 * the other entity takes the full displacement. Positions are torus-wrapped
 * after the push.
 *
 * Story 4.1 AC4.1.3-6. Spec §9.3, §1.
 */
export function resolveCollisions(
  entities: Map<number, Entity>,
  spatialIndex: SpatialIndex,
  worldW: number,
  worldH: number,
): void {
  let maxRadius = 0
  for (const e of entities.values()) {
    if (e.stats.radius > maxRadius) maxRadius = e.stats.radius
  }

  for (const [idA, entityA] of entities) {
    const queryR = entityA.stats.radius + maxRadius
    for (const idB of spatialIndex.queryRadius(entityA.position, queryR)) {
      if (idB <= idA) continue
      const entityB = entities.get(idB)
      if (entityB === undefined) continue

      const dist = torusDistance(entityA.position, entityB.position, worldW, worldH)
      const sumR = entityA.stats.radius + entityB.stats.radius
      if (dist >= sumR || dist === 0) continue

      const overlap = sumR - dist
      const dx = wrapDelta(entityB.position.x - entityA.position.x, worldW)
      const dy = wrapDelta(entityB.position.y - entityA.position.y, worldH)
      const nx = dx / dist
      const ny = dy / dist

      const aIsPlant = entityA.species === 'plant'
      const bIsPlant = entityB.species === 'plant'

      if (aIsPlant) {
        entityB.position = wrapPosition(
          { x: entityB.position.x + nx * overlap, y: entityB.position.y + ny * overlap },
          worldW,
          worldH,
        )
      } else if (bIsPlant) {
        entityA.position = wrapPosition(
          { x: entityA.position.x - nx * overlap, y: entityA.position.y - ny * overlap },
          worldW,
          worldH,
        )
      } else {
        entityA.position = wrapPosition(
          {
            x: entityA.position.x - nx * (overlap / 2),
            y: entityA.position.y - ny * (overlap / 2),
          },
          worldW,
          worldH,
        )
        entityB.position = wrapPosition(
          {
            x: entityB.position.x + nx * (overlap / 2),
            y: entityB.position.y + ny * (overlap / 2),
          },
          worldW,
          worldH,
        )
      }
    }
  }
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
