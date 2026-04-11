/**
 * World rasterizer: converts SimState to an 80×30 grid of { glyph, color } cells.
 *
 * Priority per spec §13.2:
 *   selected entity > living entities (carnivore > herbivore > decomposer > plant)
 *   > soil background
 *
 * Note: SimState does not expose dead matter (corpses, compost, poop). Those
 * priority levels (3–5) are reserved for a future SimState extension.
 *
 * Vision cone overlay per spec §13.4: rendered when selectedId is provided.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §13.
 */

import type { SimState } from '../core/sim.js'
import type { Entity } from '../core/entity.js'
import type { GlyphColor, Theme } from './theme.js'

export interface Cell {
  readonly glyph: string
  readonly color: string
  readonly bgColor?: string
}

/** Mutable cell used during construction before freezing to Cell. */
interface MutableCell {
  glyph: string
  color: string
  bgColor: string | undefined
}

/** Maps species to a numeric priority (lower = drawn on top). */
const SPECIES_PRIORITY: Record<string, number> = {
  carnivore: 0,
  herbivore: 1,
  decomposer: 2,
  plant: 3,
}

/** Highlight background for the selected entity's cell. */
const SELECTED_BG = '#334455'

/** Background tint applied to cells inside the selected entity's vision cone. */
const CONE_BG = '#1a2a1a'

/**
 * Return the grid column and row for a world position.
 * Wraps coordinates into [0, gridW) × [0, gridH).
 */
function worldToCell(
  x: number,
  y: number,
  gridW: number,
  gridH: number,
): { col: number; row: number } {
  const col = ((Math.floor(x) % gridW) + gridW) % gridW
  const row = ((Math.floor(y) % gridH) + gridH) % gridH
  return { col, row }
}

/**
 * Collect all grid positions along the line from (x0,y0) to (x1,y1) using
 * Bresenham's algorithm (integer pixel coords).
 */
function bresenham(x0: number, y0: number, x1: number, y1: number): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = []
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let cx = x0
  let cy = y0

  for (;;) {
    cells.push({ col: cx, row: cy })
    if (cx === x1 && cy === y1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      cx += sx
    }
    if (e2 < dx) {
      err += dx
      cy += sy
    }
  }
  return cells
}

/**
 * Mark cells inside the vision cone of `selected` with a cone background.
 * The cone is defined by spec §13.4: cells within spread/2 of heading and
 * within range distance.
 */
function applyConeOverlay(
  grid: MutableCell[][],
  selected: Entity,
  gridW: number,
  gridH: number,
): void {
  const { lastSense, position, orientation } = selected
  if (lastSense.range <= 0 || lastSense.spread <= 0) return

  const halfSpread = lastSense.spread / 2
  const rangeCells = Math.ceil(lastSense.range)

  for (let dr = -rangeCells; dr <= rangeCells; dr++) {
    for (let dc = -rangeCells; dc <= rangeCells; dc++) {
      const wx = dc + 0.5
      const wy = dr + 0.5
      const dist = Math.sqrt(wx * wx + wy * wy)
      if (dist > lastSense.range) continue

      const angle = Math.atan2(wy, wx)
      let delta = angle - orientation
      while (delta > Math.PI) delta -= 2 * Math.PI
      while (delta < -Math.PI) delta += 2 * Math.PI

      if (Math.abs(delta) > halfSpread) continue

      const col = (((Math.floor(position.x) + dc) % gridW) + gridW) % gridW
      const row = (((Math.floor(position.y) + dr) % gridH) + gridH) % gridH
      const cell = grid[row]?.[col]
      if (cell !== undefined) {
        cell.bgColor = CONE_BG
      }
    }
  }
}

/**
 * Draw a dashed sight-line from the selected entity toward its sensed target
 * using Bresenham, overlaying glyph '·' in cyan.
 */
function applySightLine(
  grid: MutableCell[][],
  selected: Entity,
  gridW: number,
  gridH: number,
): void {
  const { lastSense, position, orientation } = selected
  if (!lastSense.detected || lastSense.distance <= 0) return

  const tx = position.x + Math.cos(orientation) * lastSense.distance
  const ty = position.y + Math.sin(orientation) * lastSense.distance

  const { col: x0, row: y0 } = worldToCell(position.x, position.y, gridW, gridH)
  const { col: x1, row: y1 } = worldToCell(tx, ty, gridW, gridH)

  const linePoints = bresenham(x0, y0, x1, y1)
  // Skip first point (entity cell itself)
  for (let i = 1; i < linePoints.length; i++) {
    const pt = linePoints[i]
    if (pt === undefined) continue
    const col = ((pt.col % gridW) + gridW) % gridW
    const row = ((pt.row % gridH) + gridH) % gridH
    const cell = grid[row]?.[col]
    if (cell !== undefined) {
      cell.glyph = '·'
      cell.color = 'cyan'
    }
  }
}

/**
 * Rasterize `simState` into a `gridH × gridW` array of `Cell` values.
 *
 * @param simState   - Read-only sim snapshot.
 * @param worldW     - World width in world units.
 * @param worldH     - World height in world units.
 * @param theme      - Glyph/color mappings.
 * @param selectedId - If provided, highlight this entity and render vision cone.
 * @param viewportW  - Output grid width in columns (defaults to worldW).
 * @param viewportH  - Output grid height in rows (defaults to worldH).
 * @returns          Row-major 2D array: grid[row][col].
 */
export function rasterize(
  simState: SimState,
  worldW: number,
  worldH: number,
  theme: Theme,
  selectedId?: number,
  viewportW?: number,
  viewportH?: number,
): Cell[][] {
  const gridW = viewportW ?? worldW
  const gridH = viewportH ?? worldH

  // Initialise every cell to soil background
  const soil = theme.soil
  const grid: MutableCell[][] = Array.from({ length: gridH }, () =>
    Array.from({ length: gridW }, () => ({
      glyph: soil.glyph,
      color: soil.color,
      bgColor: undefined,
    })),
  )

  // Priority map: track which entity "wins" each cell
  const priority = new Int32Array(gridW * gridH).fill(999)

  // Paint living entities
  for (const entity of simState.entities.values()) {
    const col = Math.floor((entity.position.x * gridW) / worldW)
    const row = Math.floor((entity.position.y * gridH) / worldH)
    const idx = row * gridW + col
    const p = SPECIES_PRIORITY[entity.species] ?? 99
    const current = priority[idx]
    if (current === undefined || p >= current) continue
    priority[idx] = p
    const gc: GlyphColor = theme[entity.species as keyof Theme]
    const cell = grid[row]?.[col]
    if (cell !== undefined) {
      cell.glyph = gc.glyph
      cell.color = gc.color
    }
  }

  // Resolve selected entity
  const selected = selectedId !== undefined ? simState.entities.get(selectedId) : undefined

  // Vision cone overlay (before entity highlight so highlight wins on entity cell)
  if (selected !== undefined) {
    applyConeOverlay(grid, selected, gridW, gridH)
    applySightLine(grid, selected, gridW, gridH)

    // Highlight selected entity's cell
    const { col, row } = worldToCell(selected.position.x, selected.position.y, gridW, gridH)
    const gc: GlyphColor = theme[selected.species as keyof Theme]
    const cell = grid[row]?.[col]
    if (cell !== undefined) {
      cell.glyph = gc.glyph
      cell.color = gc.color
      cell.bgColor = SELECTED_BG
    }
  }

  return grid as unknown as Cell[][]
}
