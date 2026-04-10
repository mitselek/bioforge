/**
 * Screen composition: creates the blessed screen and arranges UI panels.
 *
 * `createLayout()` returns the screen and four named boxes:
 *   - worldBox:     top-left  — 80×30 world raster
 *   - hudBox:       top-right — stats / HUD
 *   - chartBox:     bottom-left — sparkline chart
 *   - inspectorBox: bottom-right — selected entity detail
 *
 * Terminal resize triggers `screen.render()` so panels reflow gracefully.
 *
 * Target minimum: 130×44 per spec §14.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §14.
 */

import * as blessed from 'blessed'
import type { Widgets } from 'blessed'

export interface Layout {
  readonly screen: Widgets.Screen
  readonly worldBox: Widgets.BoxElement
  readonly hudBox: Widgets.BoxElement
  readonly chartBox: Widgets.BoxElement
  readonly inspectorBox: Widgets.BoxElement
}

/**
 * Create and return the blessed screen with all four UI panels arranged.
 *
 * Panels use percentage-based sizing so they reflow on terminal resize.
 */
export function createLayout(): Layout {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'BioForge',
    fullUnicode: true,
    dockBorders: true,
  })

  // World panel — top-left, fixed 80×30 (world unit size)
  const worldBox = blessed.box({
    parent: screen,
    label: ' World ',
    top: 0,
    left: 0,
    width: 82, // 80 content + 2 for border
    height: 32, // 30 content + 2 for border
    border: { type: 'line' },
    tags: false,
    scrollable: false,
  })

  // HUD panel — top-right, remainder of top row
  const hudBox = blessed.box({
    parent: screen,
    label: ' HUD ',
    top: 0,
    left: 82,
    width: '100%-82',
    height: 32,
    border: { type: 'line' },
    tags: false,
    scrollable: false,
  })

  // Chart panel — bottom-left
  const chartBox = blessed.box({
    parent: screen,
    label: ' Population ',
    top: 32,
    left: 0,
    width: '50%',
    height: '100%-32',
    border: { type: 'line' },
    tags: false,
    scrollable: false,
  })

  // Inspector panel — bottom-right
  const inspectorBox = blessed.box({
    parent: screen,
    label: ' Inspector ',
    top: 32,
    left: '50%',
    width: '50%',
    height: '100%-32',
    border: { type: 'line' },
    tags: false,
    scrollable: true,
  })

  // Reflow on terminal resize
  screen.on('resize', () => {
    screen.render()
  })

  return { screen, worldBox, hudBox, chartBox, inspectorBox }
}
