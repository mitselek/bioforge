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

/**
 * Format a number to a fixed number of decimal places, right-aligned in a
 * field of `width` characters.
 */
function fmt(n: number, decimals: number, width: number): string {
  return n.toFixed(decimals).padStart(width)
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
export function renderHud(simState: SimState, cfg: Config): string[] {
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

  void cfg

  return [
    `Tick:      ${String(simState.tick).padStart(8)}`,
    `Speed:     ${fmt(cfg.baseHz, 1, 7)} Hz`,
    `Total E:   ${fmt(simState.totalEnergy, 2, 10)}`,
    `Soil E:    ${fmt(soilEnergy, 2, 10)}`,
    `---`,
    `Plant:     ${String(plant).padStart(8)}`,
    `Herbivore: ${String(herbivore).padStart(8)}`,
    `Carnivore: ${String(carnivore).padStart(8)}`,
    `Decomposer:${String(decomposer).padStart(8)}`,
    `---`,
    `Corpses:   ${String(corpses).padStart(8)}`,
    `Poop:      ${String(poop).padStart(8)}`,
    `Compost:   ${String(compost).padStart(8)}`,
  ]
}
