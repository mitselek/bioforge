/**
 * Genome — the Turing-tape representation that drives entity behavior.
 *
 * Each entity has a tape of instructions plus an instruction pointer.
 * The VM (Story 3.4) executes one instruction per tick.
 *
 * RED-phase stub — implementation in GREEN.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §7.1, §7.2.
 */

import type { Rng } from './rng.js'
import type { Config } from './config.js'

export type Opcode =
  | 'MOVE_FORWARD'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'SENSE_FOOD'
  | 'SENSE_PREDATOR'
  | 'SENSE_MATE'
  | 'JUMP_IF_TRUE'
  | 'JUMP_IF_FALSE'
  | 'REPRODUCE'

export type Instruction =
  | { readonly op: 'MOVE_FORWARD'; readonly arg1: number }
  | { readonly op: 'TURN_LEFT'; readonly arg1: number }
  | { readonly op: 'TURN_RIGHT'; readonly arg1: number }
  | { readonly op: 'SENSE_FOOD'; readonly arg1: number; readonly arg2: number }
  | { readonly op: 'SENSE_PREDATOR'; readonly arg1: number; readonly arg2: number }
  | { readonly op: 'SENSE_MATE'; readonly arg1: number; readonly arg2: number }
  | { readonly op: 'JUMP_IF_TRUE'; readonly arg1: number; readonly target: number }
  | { readonly op: 'JUMP_IF_FALSE'; readonly arg1: number; readonly target: number }
  | { readonly op: 'REPRODUCE'; readonly arg1: number }

export interface Genome {
  tape: Instruction[]
  ip: number
}

export function randomGenome(rng: Rng, cfg: Config): Genome {
  throw new Error(
    `genome.randomGenome: not implemented (initialTape=[${String(cfg.initialTapeLengthMin)},${String(cfg.initialTapeLengthMax)}] rngFloat=${typeof rng.float})`,
  )
}
