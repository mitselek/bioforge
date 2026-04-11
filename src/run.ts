/**
 * BioForge runner — launches the simulation with a fully-wired UI.
 *
 * Usage: npx tsx src/run.ts
 *
 * Wires: createLayout → startApp → bindKeys → setInterval render loop.
 *
 * (*BF:Humboldt*)
 */

import { startApp } from './main.js'
import { defaultConfig } from './core/config.js'
import { createLayout } from './ui/layout.js'
import { bindKeys } from './ui/input.js'
import { rasterize } from './ui/worldView.js'
import { renderHud, renderMiniHud } from './ui/hud.js'
import { makeChartHistory, updateChart, renderChart } from './ui/chart.js'
import { renderInspector, renderGenome } from './ui/inspector.js'
import { ASCII_THEME } from './ui/theme.js'
import { applyLayout } from './ui/layouts.js'
import type { LayoutName } from './ui/layouts.js'

const cfg = defaultConfig()
const { screen, worldBox, hudBox, miniHudBox, chartBox, inspectorBox, genomeBox } = createLayout()
const app = startApp(cfg)
const { sim, clock } = app

let chartHistory = makeChartHistory()

// Layout cycling state
const LAYOUT_ORDER: LayoutName[] = ['LAYOUT_1', 'LAYOUT_2', 'LAYOUT_ZEN', 'LAYOUT_FS']
let layoutIndex = 0

// Box mapping shared by createLayout default and cycleLayout callback
const boxes = {
  world: worldBox,
  hud: hudBox,
  miniHud: miniHudBox,
  pop: chartBox,
  inspector: inspectorBox,
  genome: genomeBox,
}

// Selection cursor state: tracks which entity index is selected for cycling
let selectedEntityIndex = 0

function selectByIndex(index: number): void {
  const ids = [...sim.state.entities.keys()]
  if (ids.length === 0) return
  const clamped = ((index % ids.length) + ids.length) % ids.length
  selectedEntityIndex = clamped
  const id = ids[clamped]
  if (id !== undefined) {
    app.selectEntity(id)
  }
}

// Bind keyboard to app callbacks
bindKeys(screen, {
  togglePause(): void {
    app.togglePause()
  },
  speedDown(): void {
    app.speedDown()
  },
  speedUp(): void {
    app.speedUp()
  },
  quit(): void {
    clearInterval(loop)
    app.quit()
    process.exit(0)
  },
  cursorUp(): void {
    selectByIndex(selectedEntityIndex - 1)
  },
  cursorDown(): void {
    selectByIndex(selectedEntityIndex + 1)
  },
  cursorLeft(): void {
    selectByIndex(selectedEntityIndex - 1)
  },
  cursorRight(): void {
    selectByIndex(selectedEntityIndex + 1)
  },
  cycleSelection(): void {
    selectByIndex(selectedEntityIndex + 1)
  },
  resetSim(): void {
    app.resetSim()
    chartHistory = makeChartHistory()
    selectedEntityIndex = 0
  },
  cycleLayout(): void {
    layoutIndex = (layoutIndex + 1) % LAYOUT_ORDER.length
    const name = LAYOUT_ORDER[layoutIndex]
    if (name !== undefined) {
      applyLayout(boxes, name, Number(screen.width), Number(screen.height))
    }
    screen.render()
  },
})

// Render loop at baseHz
const frameMs = 1000 / cfg.baseHz

const loop = setInterval(() => {
  if (!clock.paused) {
    sim.tick()
  }

  const state = sim.state

  // Apply current layout each frame so panel visibility is always correct
  const currentLayout = LAYOUT_ORDER[layoutIndex]
  if (currentLayout !== undefined) {
    applyLayout(boxes, currentLayout, Number(screen.width), Number(screen.height))
  }

  // World panel: rasterize to ASCII grid
  const selectedId = app.selectedEntity?.id
  const grid = rasterize(state, cfg.worldW, cfg.worldH, ASCII_THEME, selectedId)
  const worldLines = grid.map((row) => row.map((cell) => cell.glyph).join(''))
  worldBox.setContent(worldLines.join('\n'))

  // HUD panel
  hudBox.setContent(renderHud(state, cfg).join('\n'))

  // Mini HUD panel (visible in LAYOUT_FS only — layout controls visibility)
  miniHudBox.setContent(renderMiniHud(state).join('\n'))

  // Chart panel
  chartHistory = updateChart(chartHistory, state)
  const chartWidth = Math.max(10, (chartBox.width as number) - 14)
  chartBox.setContent(renderChart(chartHistory, chartWidth).join('\n'))

  // Inspector panel
  inspectorBox.setContent(renderInspector(app.selectedEntity, ASCII_THEME).join('\n'))

  // Genome panel
  genomeBox.setContent(renderGenome(app.selectedEntity).join('\n'))

  screen.render()
}, frameMs)

// Graceful shutdown on SIGINT
process.on('SIGINT', () => {
  clearInterval(loop)
  app.quit()
  process.exit(0)
})
