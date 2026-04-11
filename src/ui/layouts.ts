/**
 * Layout config type stub — RED phase only.
 *
 * This file is a minimal type stub created by Merian (RED) so that
 * tests/ui.test.ts can import from this path without tsc errors.
 * Linnaeus (GREEN) replaces the stub implementations with real ones.
 *
 * (*BF:Merian*)
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

// Stub: empty registry — tests will fail (RED) until GREEN populates this.
export const LAYOUTS: Record<LayoutName, LayoutConfig> = {} as Record<LayoutName, LayoutConfig>

// Stub: applyLayout — not yet implemented.
export function applyLayout(
  boxes: Record<string, unknown>,
  name: LayoutName,
  screenW: number,
  screenH: number,
): void {
  void boxes
  void name
  void screenW
  void screenH
  throw new Error('applyLayout: not yet implemented (GREEN phase)')
}
