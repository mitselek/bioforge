/**
 * Genome — the Turing-tape representation that drives entity behavior.
 *
 * Each entity has a tape of instructions plus an instruction pointer.
 * The VM (Story 3.4) executes one instruction per tick.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §7.1, §7.2.
 */

import type { Rng } from './rng.js'
import type { Config, SpeciesStats } from './config.js'

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
  // Deep-copy by mapping each instruction to a fresh object literal. The
  // parent-immutability test pins that parent.tape and its contents must
  // remain byte-identical across the call. Instructions are typed
  // `readonly` so they can't be mutated in place, but parent.tape itself
  // is mutable — rebuild the array eagerly.
  const tape: Instruction[] = parent.tape.map((inst) => mutateInstruction(rng, inst, cfg))

  // Op-swap pass: per-tape single-index swap at probability
  // cfg.mutationRates.opSwap. Picks an opcode DIFFERENT from the
  // original (BB fix — spec §8.2 strict "a different random opcode").
  if (tape.length > 0 && rng.float() < cfg.mutationRates.opSwap) {
    const idx = rng.intInRange(0, tape.length - 1)
    const old = tape[idx]
    if (old !== undefined) {
      tape[idx] = swapInstruction(rng, old, tape.length)
    }
  }

  // Insertion: per-tape rate from mutationRates.insert. Inserts a
  // biased-random instruction at a random position. Capped at
  // maxTapeLength.
  if (rng.float() < cfg.mutationRates.insert && tape.length < cfg.maxTapeLength) {
    const insertIdx = rng.intInRange(0, tape.length)
    const newInst = makeRandomInstruction(rng, tape.length + 1)
    tape.splice(insertIdx, 0, newInst)
  }

  // Deletion: per-tape rate from mutationRates.delete. Removes an
  // instruction at a random position. Floored at minTapeLength.
  if (rng.float() < cfg.mutationRates.delete && tape.length > cfg.minTapeLength) {
    const deleteIdx = rng.intInRange(0, tape.length - 1)
    tape.splice(deleteIdx, 1)
  }

  return { tape, ip: 0 }
}

function mutateInstruction(rng: Rng, inst: Instruction, cfg: Config): Instruction {
  // Arg drift: per-instruction probability cfg.mutationRates.argDrift.
  // When it fires, nudge each arg by Gaussian(0, argDriftSigma) and
  // clamp to [0, 1]. JUMP_IF_* targets are kept stable under arg drift;
  // target mutation is handled by op-swap / insertion / deletion.
  if (rng.float() >= cfg.mutationRates.argDrift) {
    return inst
  }
  const sigma = cfg.mutationRates.argDriftSigma
  const driftArg = (a: number): number => {
    const drifted = a + rng.gaussian(0, sigma)
    return Math.min(1, Math.max(0, drifted))
  }
  switch (inst.op) {
    case 'MOVE_FORWARD':
    case 'TURN_LEFT':
    case 'TURN_RIGHT':
    case 'REPRODUCE':
      return { op: inst.op, arg1: driftArg(inst.arg1) }
    case 'SENSE_FOOD':
    case 'SENSE_PREDATOR':
    case 'SENSE_MATE':
      return { op: inst.op, arg1: driftArg(inst.arg1), arg2: driftArg(inst.arg2) }
    case 'JUMP_IF_TRUE':
    case 'JUMP_IF_FALSE':
      return { op: inst.op, arg1: driftArg(inst.arg1), target: inst.target }
  }
}

function swapInstruction(rng: Rng, old: Instruction, tapeLength: number): Instruction {
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
  // Rejection sampling: pick until we get a different opcode. With 9
  // opcodes and 1 forbidden, rejection probability is 1/9 per attempt.
  let op: (typeof opcodes)[number]
  do {
    op = rng.pick(opcodes)
  } while (op === old.op)
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

export function mutateStats(rng: Rng, parent: SpeciesStats, cfg: Config): SpeciesStats {
  // Lognormal drift: value * exp(Gaussian(0, sigma)). Positive values
  // stay positive, drift is symmetric in log space. Each stat gets an
  // independent driftFactor() call.
  const driftFactor = (): number => {
    if (rng.float() >= cfg.mutationRates.statDrift) return 1.0
    return Math.exp(rng.gaussian(0, cfg.mutationRates.statDriftSigma))
  }
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

  return {
    radius: parent.radius * driftFactor(),
    maxSpeed: parent.maxSpeed * driftFactor(),
    baseMetabolicRate: parent.baseMetabolicRate * driftFactor(),
    moveCostLinear: parent.moveCostLinear * driftFactor(),
    moveCostQuadratic: parent.moveCostQuadratic * driftFactor(),
    eatRate: parent.eatRate * driftFactor(),
    absorbRate: parent.absorbRate * driftFactor(),
    efficiency: clamp(parent.efficiency * driftFactor(), 0.1, 0.99),
    lifespanMean: parent.lifespanMean * driftFactor(),
    lifespanStddev: parent.lifespanStddev * driftFactor(),
    maturityAgeMean: parent.maturityAgeMean * driftFactor(),
    maturityAgeStddev: parent.maturityAgeStddev * driftFactor(),
    reproThresholdEnergy: parent.reproThresholdEnergy * driftFactor(),
    reproCostFraction: parent.reproCostFraction * driftFactor(),
    initialEnergy: parent.initialEnergy * driftFactor(),
    maxSenseRange: parent.maxSenseRange * driftFactor(),
  }
}
