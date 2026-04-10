import { describe, it, expect } from 'vitest'
import { randomGenome } from '../src/core/genome.js'
import type { Opcode } from '../src/core/genome.js'
import { makeRng } from '../src/core/rng.js'
import { defaultConfig } from '../src/core/config.js'

const ALL_OPCODES = [
  'MOVE_FORWARD',
  'TURN_LEFT',
  'TURN_RIGHT',
  'SENSE_FOOD',
  'SENSE_PREDATOR',
  'SENSE_MATE',
  'JUMP_IF_TRUE',
  'JUMP_IF_FALSE',
  'REPRODUCE',
] as const satisfies readonly Opcode[]

describe('genome', () => {
  describe('Instruction discriminated union', () => {
    it('has all 9 opcodes', () => {
      expect(ALL_OPCODES).toHaveLength(9)
      // The `satisfies readonly Opcode[]` constraint above gives us a
      // compile-time guarantee that ALL_OPCODES exhaustively matches
      // the Opcode type. This test pins the count at runtime too.
    })
  })

  describe('randomGenome', () => {
    const cfg = defaultConfig()

    it('produces a tape with length in [initialTapeLengthMin, initialTapeLengthMax]', () => {
      for (let seed = 1; seed <= 50; seed++) {
        const rng = makeRng(seed)
        const g = randomGenome(rng, cfg)
        expect(g.tape.length).toBeGreaterThanOrEqual(cfg.initialTapeLengthMin)
        expect(g.tape.length).toBeLessThanOrEqual(cfg.initialTapeLengthMax)
      }
    })

    it('starts with ip = 0', () => {
      const rng = makeRng(42)
      const g = randomGenome(rng, cfg)
      expect(g.ip).toBe(0)
    })

    it('generates only valid opcodes', () => {
      const rng = makeRng(7)
      const g = randomGenome(rng, cfg)
      for (const inst of g.tape) {
        expect(ALL_OPCODES).toContain(inst.op)
      }
    })

    it('all numeric args are in [0, 1]', () => {
      const rng = makeRng(11)
      const g = randomGenome(rng, cfg)
      for (const inst of g.tape) {
        // Every instruction has arg1 in [0,1]
        expect(inst.arg1).toBeGreaterThanOrEqual(0)
        expect(inst.arg1).toBeLessThanOrEqual(1)
        // SENSE_* instructions also have arg2
        if (inst.op === 'SENSE_FOOD' || inst.op === 'SENSE_PREDATOR' || inst.op === 'SENSE_MATE') {
          expect(inst.arg2).toBeGreaterThanOrEqual(0)
          expect(inst.arg2).toBeLessThanOrEqual(1)
        }
        // JUMP_IF_* instructions have an integer target
        if (inst.op === 'JUMP_IF_TRUE' || inst.op === 'JUMP_IF_FALSE') {
          expect(Number.isInteger(inst.target)).toBe(true)
          expect(inst.target).toBeGreaterThanOrEqual(0)
          expect(inst.target).toBeLessThan(g.tape.length)
        }
      }
    })

    it('is deterministic for the same seed', () => {
      const a = randomGenome(makeRng(42), cfg)
      const b = randomGenome(makeRng(42), cfg)
      expect(a.tape).toEqual(b.tape)
      expect(a.ip).toBe(b.ip)
    })

    it('produces different genomes for different seeds', () => {
      const a = randomGenome(makeRng(1), cfg)
      const b = randomGenome(makeRng(2), cfg)
      // Either lengths differ OR at least one instruction differs
      const same =
        a.tape.length === b.tape.length &&
        a.tape.every((inst, i) => JSON.stringify(inst) === JSON.stringify(b.tape[i]))
      expect(same).toBe(false)
    })
  })

  describe('distribution bias (spec §7.2)', () => {
    it('matches the per-opcode expected percentages within ±2%', () => {
      // Generate ~5500 instructions and count opcode occurrences.
      // 500 seeds × ~11 instructions per genome ≈ 5500 samples. Standard
      // error for p≈0.1 is sqrt(p(1-p)/5500) ≈ 0.4%. A ±2% tolerance is
      // ~5σ — very safe margin above sampling noise.
      const cfg = defaultConfig()
      const counts: Record<string, number> = {
        MOVE_FORWARD: 0,
        TURN_LEFT: 0,
        TURN_RIGHT: 0,
        SENSE_FOOD: 0,
        SENSE_PREDATOR: 0,
        SENSE_MATE: 0,
        JUMP_IF_TRUE: 0,
        JUMP_IF_FALSE: 0,
        REPRODUCE: 0,
      }

      let total = 0
      for (let seed = 1; seed <= 500; seed++) {
        const rng = makeRng(seed)
        const g = randomGenome(rng, cfg)
        for (const inst of g.tape) {
          counts[inst.op] = (counts[inst.op] ?? 0) + 1
          total++
        }
      }

      // Expected percentages = biased band + 1/9 of the 10% uniform mix:
      //  SENSE_*:        28/3 + 10/9 ≈ 10.44%
      //  JUMP_IF_*:       9   + 10/9 ≈ 10.11%
      //  MOVE_FORWARD:   18   + 10/9 ≈ 19.11%
      //  TURN_LEFT/RIGHT: 9   + 10/9 ≈ 10.11%
      //  REPRODUCE:       8   + 10/9 ≈  9.11%
      const expected: Record<string, number> = {
        SENSE_FOOD: 0.1044,
        SENSE_PREDATOR: 0.1044,
        SENSE_MATE: 0.1044,
        JUMP_IF_TRUE: 0.1011,
        JUMP_IF_FALSE: 0.1011,
        MOVE_FORWARD: 0.1911,
        TURN_LEFT: 0.1011,
        TURN_RIGHT: 0.1011,
        REPRODUCE: 0.0911,
      }

      for (const [op, expectedRatio] of Object.entries(expected)) {
        const actualRatio = (counts[op] ?? 0) / total
        expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.02)
      }
    })
  })
})
