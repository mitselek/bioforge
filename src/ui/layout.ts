/**
 * Screen composition: creates the blessed screen and arranges UI panels.
 *
 * `createLayout()` returns the screen and six named boxes:
 *   - worldBox:     top-left  — simulation world raster
 *   - hudBox:       right column — stats / HUD
 *   - miniHudBox:   floating top-left — compact counts (LAYOUT_FS only)
 *   - chartBox:     bottom-left — sparkline chart
 *   - inspectorBox: bottom-right — selected entity detail
 *   - genomeBox:    bottom panel — genome tape with IP highlight
 *
 * LAYOUT_1 is applied as the default on creation. Terminal resize triggers
 * `screen.render()` so panels reflow gracefully.
 *
 * Target minimum: 130×44 per spec §14.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §14.
 */

import blessed from 'blessed'
import type { Widgets } from 'blessed'
import { applyLayout } from './layouts.js'

export interface Layout {
  readonly screen: Widgets.Screen
  readonly worldBox: Widgets.BoxElement
  readonly hudBox: Widgets.BoxElement
  readonly miniHudBox: Widgets.BoxElement
  readonly chartBox: Widgets.BoxElement
  readonly inspectorBox: Widgets.BoxElement
  readonly genomeBox: Widgets.BoxElement
}

/**
 * Create and return the blessed screen with all six UI panels arranged.
 * LAYOUT_1 is applied as the default layout.
 */
export function createLayout(): Layout {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'BioForge',
    fullUnicode: true,
    dockBorders: true,
  })

  const worldBox = blessed.box({
    parent: screen,
    label: ' World ',
    top: 0,
    left: 0,
    width: '100%-24',
    height: '100%-18',
    border: { type: 'line' },
    tags: false,
    scrollable: false,
  })

  const hudBox = blessed.box({
    parent: screen,
    label: ' HUD ',
    top: 0,
    left: '100%-24',
    width: 24,
    height: '100%-18',
    border: { type: 'line' },
    tags: false,
    scrollable: false,
  })

  const miniHudBox = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    tags: false,
    scrollable: false,
  })

  const chartBox = blessed.box({
    parent: screen,
    label: ' Population ',
    top: '100%-18',
    left: 0,
    width: '100%-32',
    height: 6,
    border: { type: 'line' },
    tags: false,
    scrollable: false,
  })

  const inspectorBox = blessed.box({
    parent: screen,
    label: ' Inspector ',
    top: '100%-12',
    left: 0,
    width: '100%-32',
    height: 12,
    border: { type: 'line' },
    tags: false,
    scrollable: true,
  })

  const genomeBox = blessed.box({
    parent: screen,
    label: ' Genome ',
    top: '100%-18',
    left: '100%-32',
    width: 32,
    height: 18,
    border: { type: 'line' },
    tags: false,
    scrollable: true,
  })

  const boxes = {
    world: worldBox,
    hud: hudBox,
    miniHud: miniHudBox,
    pop: chartBox,
    inspector: inspectorBox,
    genome: genomeBox,
  }
  applyLayout(boxes, 'LAYOUT_1', 0, 0)

  screen.on('resize', () => {
    screen.render()
  })

  return { screen, worldBox, hudBox, miniHudBox, chartBox, inspectorBox, genomeBox }
}
