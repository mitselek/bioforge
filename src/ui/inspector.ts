/**
 * Inspector panel: formats selected-entity details as display strings.
 *
 * `renderInspector(entity, theme)` returns lines showing species, age,
 * energy, maturity, last sense result, and genome tape with IP highlight.
 * Returns a placeholder when called with `undefined`.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §14.
 */

import type { Entity } from '../core/entity.js'
import type { Theme } from './theme.js'

/** Highlight marker placed at the current instruction pointer position. */
const IP_MARKER = '>'

/** Placeholder shown when no entity is selected. */
const NO_SELECTION_LINES = ['[no entity selected]']

/**
 * Format an instruction for display.
 * Example: "MOVE_FORWARD(0.5)" or "JUMP_IF_TRUE(1.0→3)"
 */
function fmtInstruction(inst: Entity['genome']['tape'][number]): string {
  switch (inst.op) {
    case 'MOVE_FORWARD':
    case 'TURN_LEFT':
    case 'TURN_RIGHT':
    case 'REPRODUCE':
      return `${inst.op}(${inst.arg1.toFixed(2)})`
    case 'SENSE_FOOD':
    case 'SENSE_PREDATOR':
    case 'SENSE_MATE':
      return `${inst.op}(${inst.arg1.toFixed(2)},${inst.arg2.toFixed(2)})`
    case 'JUMP_IF_TRUE':
    case 'JUMP_IF_FALSE':
      return `${inst.op}(${inst.arg1.toFixed(2)}→${String(inst.target)})`
  }
}

/**
 * Return inspector lines for the given entity, or a placeholder if undefined.
 *
 * @param entity - Selected entity, or undefined for no selection.
 * @param theme  - Theme (currently unused; reserved for future glyph display).
 */
export function renderInspector(entity: Entity | undefined, theme: Theme): string[] {
  void theme

  if (entity === undefined) {
    return NO_SELECTION_LINES.slice()
  }

  const { id, species, age, lifespan, maturityAge, energy, lastSense, genome } = entity

  const mature = age >= maturityAge ? 'mature' : 'juvenile'

  const senseStr = lastSense.detected
    ? `${lastSense.kind} dist=${lastSense.distance.toFixed(1)} angle=${lastSense.angle.toFixed(2)}`
    : `${lastSense.kind} (none)`

  const tapeLines = genome.tape.map((inst, i) => {
    const prefix = i === genome.ip ? IP_MARKER : ' '
    return `  ${prefix}[${String(i).padStart(2)}] ${fmtInstruction(inst)}`
  })

  return [
    `ID:        ${String(id).padStart(8)}`,
    `Species:   ${species}`,
    `Age:       ${String(age).padStart(5)} / ${String(lifespan).padStart(5)}  (${mature})`,
    `Energy:    ${energy.toFixed(2).padStart(10)}`,
    `Sense:     ${senseStr}`,
    `Genome (${String(genome.tape.length)} instr, ip=${String(genome.ip)}):`,
    ...tapeLines,
  ]
}
