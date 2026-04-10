/**
 * ASCII sparkline population chart.
 *
 * `updateChart` appends the current tick's counts/energy to a rolling
 * 60-tick history. `renderChart` converts that history to sparkline lines.
 *
 * Two modes (controlled by the caller via `mode`):
 *   - 'count'  — entity counts per species
 *   - 'energy' — total living energy (summed from entities)
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §14.
 */

import type { SimState } from '../core/sim.js'

export type ChartMode = 'count' | 'energy'

/** One data point in the history window. */
export interface ChartPoint {
  readonly plant: number
  readonly herbivore: number
  readonly carnivore: number
  readonly decomposer: number
  readonly livingEnergy: number
}

/** Rolling history — max 60 entries. */
export interface ChartHistory {
  readonly points: ChartPoint[]
  readonly maxPoints: number
}

const SPARKLINE_CHARS = ' ▁▂▃▄▅▆▇█'

/** Create an empty chart history. */
export function makeChartHistory(maxPoints = 60): ChartHistory {
  return { points: [], maxPoints }
}

/** Append current simState snapshot to history, evicting oldest if full. */
export function updateChart(history: ChartHistory, simState: SimState): ChartHistory {
  const livingEnergy = Array.from(simState.entities.values()).reduce((s, e) => s + e.energy, 0)
  const point: ChartPoint = {
    plant: simState.countsBySpecies['plant'] ?? 0,
    herbivore: simState.countsBySpecies['herbivore'] ?? 0,
    carnivore: simState.countsBySpecies['carnivore'] ?? 0,
    decomposer: simState.countsBySpecies['decomposer'] ?? 0,
    livingEnergy,
  }
  const next =
    history.points.length >= history.maxPoints ? history.points.slice(1) : history.points.slice()
  return { points: [...next, point], maxPoints: history.maxPoints }
}

/** Map a series of values to a sparkline string of `width` characters. */
function sparkline(values: number[], width: number): string {
  if (values.length === 0) return ' '.repeat(width)

  // Sample `width` values from the history (last `width` entries)
  const sample = values.length <= width ? values : values.slice(values.length - width)

  const max = Math.max(...sample)
  const chars = SPARKLINE_CHARS
  const steps = chars.length - 1

  return sample
    .map((v) => {
      const idx = max === 0 ? 0 : Math.round((v / max) * steps)
      return chars[idx] ?? chars[0] ?? ' '
    })
    .join('')
    .padStart(width)
}

/**
 * Render the chart history as display lines.
 *
 * @param history - Rolling history produced by `updateChart`.
 * @param width   - Character width for sparklines (default 60).
 * @param mode    - 'count' (entity counts) or 'energy' (living energy).
 * @returns       Array of display strings, one per tracked series.
 */
export function renderChart(
  history: ChartHistory,
  width = 60,
  mode: ChartMode = 'count',
): string[] {
  if (mode === 'energy') {
    const energyVals = history.points.map((p) => p.livingEnergy)
    return [`Living E: ${sparkline(energyVals, width)}`]
  }

  const plantVals = history.points.map((p) => p.plant)
  const herbVals = history.points.map((p) => p.herbivore)
  const carnVals = history.points.map((p) => p.carnivore)
  const decompVals = history.points.map((p) => p.decomposer)

  return [
    `Plant:     ${sparkline(plantVals, width)}`,
    `Herbivore: ${sparkline(herbVals, width)}`,
    `Carnivore: ${sparkline(carnVals, width)}`,
    `Decomposer:${sparkline(decompVals, width)}`,
  ]
}
