/**
 * Genome — the Turing-tape representation that drives entity behavior.
 *
 * Each entity has a tape of instructions plus an instruction pointer.
 * The VM (Story 3.4) executes one instruction per tick.
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
  const length = rng.intInRange(cfg.initialTapeLengthMin, cfg.initialTapeLengthMax)
  const tape: Instruction[] = []
  for (let i = 0; i < length; i++) {
    tape.push(makeRandomInstruction(rng, length))
  }
  return { tape, ip: 0 }
}

export function mutateGenome(rng: Rng, parent: Genome, cfg: Config): Genome {
  throw new Error(
    `genome.mutateGenome: not implemented (parentLen=${String(parent.tape.length)} argDrift=${String(cfg.mutationRates.argDrift)} opSwap=${String(cfg.mutationRates.opSwap)} rngFloat=${typeof rng.float})`,
  )
}

function makeRandomInstruction(rng: Rng, tapeLength: number): Instruction {
  // Biased distribution per spec §7.2 (rebalanced for the 9-opcode set
  // including REPRODUCE):
  //  28% SENSE_* (food/predator/mate, ~9.3% each)
  //  18% JUMP_IF_* (true/false, 9% each)
  //  18% MOVE_FORWARD
  //  18% TURN_LEFT/TURN_RIGHT (9% each)
  //   8% REPRODUCE
  //  10% uniform-random across all 9 opcodes
  const r = rng.float()
  if (r < 0.28) {
    // SENSE_*
    const which = rng.float()
    if (which < 1 / 3) {
      return { op: 'SENSE_FOOD', arg1: rng.float(), arg2: rng.float() }
    } else if (which < 2 / 3) {
      return { op: 'SENSE_PREDATOR', arg1: rng.float(), arg2: rng.float() }
    } else {
      return { op: 'SENSE_MATE', arg1: rng.float(), arg2: rng.float() }
    }
  } else if (r < 0.46) {
    // JUMP_IF_*
    const which = rng.float()
    const target = rng.intInRange(0, tapeLength - 1)
    if (which < 0.5) {
      return { op: 'JUMP_IF_TRUE', arg1: rng.float(), target }
    } else {
      return { op: 'JUMP_IF_FALSE', arg1: rng.float(), target }
    }
  } else if (r < 0.64) {
    return { op: 'MOVE_FORWARD', arg1: rng.float() }
  } else if (r < 0.82) {
    // TURN_LEFT or TURN_RIGHT
    if (rng.float() < 0.5) {
      return { op: 'TURN_LEFT', arg1: rng.float() }
    } else {
      return { op: 'TURN_RIGHT', arg1: rng.float() }
    }
  } else if (r < 0.9) {
    return { op: 'REPRODUCE', arg1: rng.float() }
  } else {
    // 10% uniform-random across all 9 opcodes
    return makeUniformRandomInstruction(rng, tapeLength)
  }
}

function makeUniformRandomInstruction(rng: Rng, tapeLength: number): Instruction {
  const opcodes = [
    'MOVE_FORWARD',
    'TURN_LEFT',
    'TURN_RIGHT',
    'SENSE_FOOD',
    'SENSE_PREDATOR',
    'SENSE_MATE',
    'JUMP_IF_TRUE',
    'JUMP_IF_FALSE',
    'REPRODUCE',
  ] as const
  const op = rng.pick(opcodes)
  switch (op) {
    case 'MOVE_FORWARD':
    case 'TURN_LEFT':
    case 'TURN_RIGHT':
    case 'REPRODUCE':
      return { op, arg1: rng.float() }
    case 'SENSE_FOOD':
    case 'SENSE_PREDATOR':
    case 'SENSE_MATE':
      return { op, arg1: rng.float(), arg2: rng.float() }
    case 'JUMP_IF_TRUE':
    case 'JUMP_IF_FALSE':
      return { op, arg1: rng.float(), target: rng.intInRange(0, tapeLength - 1) }
  }
}
