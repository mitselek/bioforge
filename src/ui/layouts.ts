/**
 * Layout config registry — named panel position/size definitions.
 *
 * Each LayoutConfig defines top/left/width/height for all 6 UI panels.
 * Hidden panels have width: 0 or height: 0.
 *
 * `applyLayout(boxes, name, screenW, screenH)` stamps the named config
 * onto a set of blessed-compatible box objects.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §14 and
 * ~/.claude/plans/jolly-zooming-twilight.md §AC1.
 *
 * (*BF:Linnaeus*)
 */

export interface PanelConfig {
  readonly top: number | string
  readonly left: number | string
  readonly width: number | string
  readonly height: number | string
}

export interface LayoutConfig {
  readonly world: PanelConfig
  readonly hud: PanelConfig
  readonly miniHud: PanelConfig
  readonly pop: PanelConfig
  readonly inspector: PanelConfig
  readonly genome: PanelConfig
}

export type LayoutName = 'LAYOUT_1' | 'LAYOUT_2' | 'LAYOUT_ZEN' | 'LAYOUT_FS'

// LAYOUT_1: Classic + Genome
// World fills top-left (dynamic width = total - HUD 24), full height minus bottom row (18)
// HUD: 24w, right column, top
// Genome: 32w × 18h, bottom-right
// Pop: dynamic w (total - 32), 6h, bottom-left
// Inspector: dynamic w (total - 32), 12h, below pop
// miniHud: hidden
const LAYOUT_1: LayoutConfig = {
  world: { top: 0, left: 0, width: '100%-24', height: '100%-18' },
  hud: { top: 0, left: '100%-24', width: 24, height: '100%-18' },
  miniHud: { top: 0, left: 0, width: 0, height: 0 },
  pop: { top: '100%-18', left: 0, width: '100%-32', height: 6 },
  inspector: { top: '100%-12', left: 0, width: '100%-32', height: 12 },
  genome: { top: '100%-18', left: '100%-32', width: 32, height: 18 },
}

// LAYOUT_2: Full-width World
// World fills full width, top portion
// Bottom row: Pop | Genome | HUD side by side
// Pop: dynamic w, 6h top of bottom row; Inspector: dynamic w, 12h below pop
// Genome: 32w × 18h, middle of bottom row
// HUD: 24w × 18h, right of bottom row
// miniHud: hidden
const LAYOUT_2: LayoutConfig = {
  world: { top: 0, left: 0, width: '100%', height: '100%-18' },
  hud: { top: '100%-18', left: '100%-24', width: 24, height: 18 },
  miniHud: { top: 0, left: 0, width: 0, height: 0 },
  pop: { top: '100%-18', left: 0, width: '100%-56', height: 6 },
  inspector: { top: '100%-12', left: 0, width: '100%-56', height: 12 },
  genome: { top: '100%-18', left: '100%-56', width: 32, height: 18 },
}

// LAYOUT_ZEN: Fullscreen map — only world visible
const LAYOUT_ZEN: LayoutConfig = {
  world: { top: 0, left: 0, width: '100%', height: '100%' },
  hud: { top: 0, left: 0, width: 0, height: 0 },
  miniHud: { top: 0, left: 0, width: 0, height: 0 },
  pop: { top: 0, left: 0, width: 0, height: 0 },
  inspector: { top: 0, left: 0, width: 0, height: 0 },
  genome: { top: 0, left: 0, width: 0, height: 0 },
}

// LAYOUT_FS: Fullscreen + Mini HUD (floating 6×4 top-left)
const LAYOUT_FS: LayoutConfig = {
  world: { top: 0, left: 0, width: '100%', height: '100%' },
  hud: { top: 0, left: 0, width: 0, height: 0 },
  miniHud: { top: 0, left: 0, width: 6, height: 4 },
  pop: { top: 0, left: 0, width: 0, height: 0 },
  inspector: { top: 0, left: 0, width: 0, height: 0 },
  genome: { top: 0, left: 0, width: 0, height: 0 },
}

export const LAYOUTS: Record<LayoutName, LayoutConfig> = {
  LAYOUT_1,
  LAYOUT_2,
  LAYOUT_ZEN,
  LAYOUT_FS,
}

interface BoxLike {
  top: number | string
  left: number | string
  width: number | string
  height: number | string
}

/**
 * Apply the named layout config onto the provided box objects.
 * Each box must have top/left/width/height properties.
 */
export function applyLayout(
  boxes: Record<string, BoxLike>,
  name: LayoutName,
  screenW: number,
  screenH: number,
): void {
  void screenW
  void screenH
  const cfg = LAYOUTS[name]
  const panels: (keyof LayoutConfig)[] = ['world', 'hud', 'miniHud', 'pop', 'inspector', 'genome']
  for (const panel of panels) {
    const box = boxes[panel]
    if (box === undefined) continue
    const p = cfg[panel]
    box.top = p.top
    box.left = p.left
    box.width = p.width
    box.height = p.height
  }
}
