/**
 * HUD panel: formats simulation statistics as a list of display strings.
 *
 * `renderHud(simState, cfg)` returns one string per line suitable for
 * writing into a blessed box or stdout.
 *
 * Note: SimState does not expose soil energy or dead-matter counts directly.
 * Living energy is summed from the entities map; soil is derived as
 * totalEnergy − livingEnergy. Dead-matter counts show 0 until SimState
 * is extended.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §14.
 */

import type { SimState } from '../core/sim.js'
import type { Config } from '../core/config.js'
import type { ChartHistory } from './chart.js'
import type { Clock } from '../core/clock.js'

const SPARK_CHARS = ' ▁▂▃▄▅▆▇█'

function miniSparkline(values: number[], width: number): string {
  if (values.length === 0) return ' '.repeat(width)
  const sample = values.length <= width ? values : values.slice(values.length - width)
  const max = Math.max(...sample)
  return sample
    .map((v) => {
      const idx = max === 0 ? 0 : Math.round((v / max) * (SPARK_CHARS.length - 1))
      return SPARK_CHARS[idx] ?? ' '
    })
    .join('')
    .padStart(width)
}

/**
 * Format a number to a fixed number of decimal places, right-aligned in a
 * field of `width` characters.
 */
function fmt(n: number, decimals: number, width: number): string {
  return n.toFixed(decimals).padStart(width)
}

/**
 * Return mini HUD lines showing per-species counts for LAYOUT_FS overlay.
 *
 * Returns exactly 4 lines: P:<plant>, H:<herbivore>, C:<carnivore>, D:<decomposer>.
 */
export function renderMiniHud(simState: SimState): string[] {
  const plant = simState.countsBySpecies['plant'] ?? 0
  const herbivore = simState.countsBySpecies['herbivore'] ?? 0
  const carnivore = simState.countsBySpecies['carnivore'] ?? 0
  const decomposer = simState.countsBySpecies['decomposer'] ?? 0
  return [
    `P:${String(plant)}`,
    `H:${String(herbivore)}`,
    `C:${String(carnivore)}`,
    `D:${String(decomposer)}`,
  ]
}

/**
 * Return HUD lines for the current sim state.
 *
 * Lines:
 *   Tick:      <tick>
 *   Speed:     <baseHz> Hz
 *   Total E:   <totalEnergy>
 *   Soil E:    <soilEnergy>
 *   --- entities ---
 *   Plant:     <count>
 *   Herbivore: <count>
 *   Carnivore: <count>
 *   Decomposer:<count>
 *   --- dead matter ---
 *   Corpses:   <count>
 *   Poop:      <count>
 *   Compost:   <count>
 */
export function renderHud(simState: SimState, cfg: Config, chartHistory?: ChartHistory): string[] {
  const livingEnergy = Array.from(simState.entities.values()).reduce((sum, e) => sum + e.energy, 0)
  const soilEnergy = simState.totalEnergy - livingEnergy

  const plant = simState.countsBySpecies['plant'] ?? 0
  const herbivore = simState.countsBySpecies['herbivore'] ?? 0
  const carnivore = simState.countsBySpecies['carnivore'] ?? 0
  const decomposer = simState.countsBySpecies['decomposer'] ?? 0

  // Dead matter counts are not yet available in SimState.
  const corpses = 0
  const poop = 0
  const compost = 0

  const sparkWidth = 20
  const pts = chartHistory?.points ?? []
  const plantSpark = miniSparkline(
    pts.map((p) => p.plant),
    sparkWidth,
  )
  const herbSpark = miniSparkline(
    pts.map((p) => p.herbivore),
    sparkWidth,
  )
  const carnSpark = miniSparkline(
    pts.map((p) => p.carnivore),
    sparkWidth,
  )
  const decompSpark = miniSparkline(
    pts.map((p) => p.decomposer),
    sparkWidth,
  )

  return [
    `Tick:      ${String(simState.tick).padStart(8)}`,
    `Speed:     ${fmt(cfg.baseHz, 1, 7)} Hz`,
    `Total E:   ${fmt(simState.totalEnergy, 2, 10)}`,
    `Soil E:    ${fmt(soilEnergy, 2, 10)}`,
    `---`,
    `Plant:     ${String(plant).padStart(8)}`,
    plantSpark,
    `Herbivore: ${String(herbivore).padStart(8)}`,
    herbSpark,
    `Carnivore: ${String(carnivore).padStart(8)}`,
    carnSpark,
    `Decomposer:${String(decomposer).padStart(8)}`,
    decompSpark,
    `---`,
    `Corpses:   ${String(corpses).padStart(8)}`,
    `Poop:      ${String(poop).padStart(8)}`,
    `Compost:   ${String(compost).padStart(8)}`,
  ]
}

/**
 * Return keyboard control hint lines and current speed for the controls panel.
 */
export function renderControls(clock: Clock): string[] {
  return [
    `[space] pause/resume`,
    `[r] restart  [q] quit`,
    `[l] layout`,
    `Speed: ${clock.speed.toFixed(1)}x`,
  ]
}
