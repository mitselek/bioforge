import { describe, it, expect } from 'vitest'
import { randomGenome, mutateGenome, mutateStats } from '../src/core/genome.js'
import type { Opcode } from '../src/core/genome.js'
import { makeRng } from '../src/core/rng.js'
import { defaultConfig, makeConfig } from '../src/core/config.js'

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

  describe('mutateGenome', () => {
    const cfg = defaultConfig()

    it('returns a genome within tape-length bounds with ip = 0', () => {
      // With default mutation rates, length is USUALLY preserved
      // (insert/delete are ~3% per tape each) but not guaranteed.
      // Cycle 2 will pin length-change invariants directly.
      const rng = makeRng(42)
      const parent = randomGenome(makeRng(7), cfg)
      const child = mutateGenome(rng, parent, cfg)
      expect(child.tape.length).toBeGreaterThanOrEqual(cfg.minTapeLength)
      expect(child.tape.length).toBeLessThanOrEqual(cfg.maxTapeLength)
      expect(child.ip).toBe(0)
    })

    it('does not mutate the parent genome (returns a fresh copy)', () => {
      const parent = randomGenome(makeRng(7), cfg)
      const parentSnapshot = JSON.stringify(parent)
      const rng = makeRng(42)
      mutateGenome(rng, parent, cfg)
      // Parent must be byte-identical after mutation — no aliasing
      expect(JSON.stringify(parent)).toBe(parentSnapshot)
    })

    it('arg drift: mutated args stay in [0, 1] after clamping', () => {
      // Force high drift to stress the clamp: 100% per-instruction drift
      // with σ = 0.5 pushes args far from their original values.
      const highMutCfg = makeConfig({
        mutationRates: {
          ...cfg.mutationRates,
          argDrift: 1.0,
          argDriftSigma: 0.5,
          opSwap: 0,
          insert: 0,
          delete: 0,
          statDrift: 0,
        },
      })
      const parent = randomGenome(makeRng(7), highMutCfg)
      for (let seed = 1; seed <= 50; seed++) {
        const child = mutateGenome(makeRng(seed), parent, highMutCfg)
        for (const inst of child.tape) {
          expect(inst.arg1).toBeGreaterThanOrEqual(0)
          expect(inst.arg1).toBeLessThanOrEqual(1)
          if (
            inst.op === 'SENSE_FOOD' ||
            inst.op === 'SENSE_PREDATOR' ||
            inst.op === 'SENSE_MATE'
          ) {
            expect(inst.arg2).toBeGreaterThanOrEqual(0)
            expect(inst.arg2).toBeLessThanOrEqual(1)
          }
        }
      }
    })

    it('op swap: mutated tape contains only valid opcodes', () => {
      const highSwapCfg = makeConfig({
        mutationRates: {
          ...cfg.mutationRates,
          argDrift: 0,
          opSwap: 1.0,
          insert: 0,
          delete: 0,
          statDrift: 0,
        },
      })
      const validOpcodes = new Set<string>([
        'MOVE_FORWARD',
        'TURN_LEFT',
        'TURN_RIGHT',
        'SENSE_FOOD',
        'SENSE_PREDATOR',
        'SENSE_MATE',
        'JUMP_IF_TRUE',
        'JUMP_IF_FALSE',
        'REPRODUCE',
      ])
      const parent = randomGenome(makeRng(7), highSwapCfg)
      const child = mutateGenome(makeRng(42), parent, highSwapCfg)
      for (const inst of child.tape) {
        expect(validOpcodes.has(inst.op)).toBe(true)
      }
    })

    it('is deterministic for the same seed', () => {
      const parent = randomGenome(makeRng(7), cfg)
      const a = mutateGenome(makeRng(42), parent, cfg)
      const b = mutateGenome(makeRng(42), parent, cfg)
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    })

    it('jump targets remain valid integers in [0, tape.length - 1]', () => {
      const highMutCfg = makeConfig({
        mutationRates: {
          ...cfg.mutationRates,
          argDrift: 1.0,
          opSwap: 1.0,
          insert: 0,
          delete: 0,
          statDrift: 0,
        },
      })
      const parent = randomGenome(makeRng(7), highMutCfg)
      const child = mutateGenome(makeRng(42), parent, highMutCfg)
      for (const inst of child.tape) {
        if (inst.op === 'JUMP_IF_TRUE' || inst.op === 'JUMP_IF_FALSE') {
          expect(Number.isInteger(inst.target)).toBe(true)
          expect(inst.target).toBeGreaterThanOrEqual(0)
          expect(inst.target).toBeLessThan(child.tape.length)
        }
      }
    })
  })

  describe('mutateGenome op swap (BB fix)', () => {
    it('swap always picks a different opcode (spec §8.2 strict)', () => {
      // Spec §8.2 says op-swap picks "a different random opcode". With
      // opSwap=1.0 and argDrift=0, every call swaps exactly one index
      // and every other position is identity-copied. If the swap is
      // allowed to roll the same opcode (1/9 chance under uniform pick),
      // `anyDifferent` is false for that seed and the test fires.
      //
      // Across 100 seeds, the probability that a buggy impl never rolls
      // same-opcode is (8/9)^100 ≈ 7.7e-6 — test catches the bug with
      // probability > 99.999% on the first offending seed.
      const cfg = makeConfig({
        mutationRates: {
          ...defaultConfig().mutationRates,
          argDrift: 0,
          opSwap: 1.0,
          insert: 0,
          delete: 0,
          statDrift: 0,
        },
      })
      const parent = randomGenome(makeRng(7), cfg)
      for (let seed = 1; seed <= 100; seed++) {
        const child = mutateGenome(makeRng(seed), parent, cfg)
        const anyDifferent = child.tape.some((inst, i) => inst.op !== parent.tape[i]?.op)
        expect(anyDifferent).toBe(true)
      }
    })
  })

  describe('mutateGenome insertion', () => {
    const cfg = makeConfig({
      mutationRates: {
        ...defaultConfig().mutationRates,
        argDrift: 0,
        opSwap: 0,
        insert: 1.0, // always insert
        delete: 0,
        statDrift: 0,
      },
    })

    it('insertion grows tape by exactly 1', () => {
      const parent = randomGenome(makeRng(7), cfg)
      const parentLength = parent.tape.length
      const child = mutateGenome(makeRng(42), parent, cfg)
      expect(child.tape.length).toBe(parentLength + 1)
    })

    it('insertion is capped at maxTapeLength', () => {
      // Force the parent to be at max length, then insert — should stay at max
      const tightCfg = makeConfig({
        ...cfg,
        maxTapeLength: 5,
        initialTapeLengthMin: 5,
        initialTapeLengthMax: 5,
      })
      const parent = randomGenome(makeRng(7), tightCfg)
      expect(parent.tape.length).toBe(5)
      const child = mutateGenome(makeRng(42), parent, tightCfg)
      expect(child.tape.length).toBe(5) // capped, no growth
    })

    it('inserted instruction is a valid opcode', () => {
      const parent = randomGenome(makeRng(7), cfg)
      const child = mutateGenome(makeRng(42), parent, cfg)
      const validOpcodes = new Set<string>([
        'MOVE_FORWARD',
        'TURN_LEFT',
        'TURN_RIGHT',
        'SENSE_FOOD',
        'SENSE_PREDATOR',
        'SENSE_MATE',
        'JUMP_IF_TRUE',
        'JUMP_IF_FALSE',
        'REPRODUCE',
      ])
      for (const inst of child.tape) {
        expect(validOpcodes.has(inst.op)).toBe(true)
      }
    })
  })

  describe('mutateGenome deletion', () => {
    const cfg = makeConfig({
      mutationRates: {
        ...defaultConfig().mutationRates,
        argDrift: 0,
        opSwap: 0,
        insert: 0,
        delete: 1.0, // always delete
        statDrift: 0,
      },
    })

    it('deletion shrinks tape by exactly 1', () => {
      const parent = randomGenome(makeRng(7), cfg)
      const parentLength = parent.tape.length
      const child = mutateGenome(makeRng(42), parent, cfg)
      expect(child.tape.length).toBe(parentLength - 1)
    })

    it('deletion is floored at minTapeLength', () => {
      // Force the parent to be at min length, then delete — should stay at min
      const tightCfg = makeConfig({
        ...cfg,
        minTapeLength: 3,
        initialTapeLengthMin: 3,
        initialTapeLengthMax: 3,
      })
      const parent = randomGenome(makeRng(7), tightCfg)
      expect(parent.tape.length).toBe(3)
      const child = mutateGenome(makeRng(42), parent, tightCfg)
      expect(child.tape.length).toBe(3) // floored, no shrinkage
    })
  })

  describe('mutateStats', () => {
    const cfg = defaultConfig()

    it('returns stats unchanged when drift rate is 0', () => {
      const noDrift = makeConfig({
        mutationRates: { ...cfg.mutationRates, statDrift: 0 },
      })
      const child = mutateStats(makeRng(42), cfg.species.herbivore, noDrift)
      expect(child).toEqual(cfg.species.herbivore)
    })

    it('drifts numeric stats lognormally when drift fires', () => {
      const heavyDrift = makeConfig({
        mutationRates: {
          ...cfg.mutationRates,
          statDrift: 1.0, // always drift
          statDriftSigma: 0.2,
        },
      })
      const child = mutateStats(makeRng(42), cfg.species.herbivore, heavyDrift)
      // Stats should differ from parent (with very high probability)
      expect(child.maxSpeed).not.toBe(cfg.species.herbivore.maxSpeed)
      expect(child.baseMetabolicRate).not.toBe(cfg.species.herbivore.baseMetabolicRate)
    })

    it('keeps stats finite and non-negative', () => {
      const heavyDrift = makeConfig({
        mutationRates: {
          ...cfg.mutationRates,
          statDrift: 1.0,
          statDriftSigma: 0.5,
        },
      })
      for (let seed = 1; seed <= 50; seed++) {
        const child = mutateStats(makeRng(seed), cfg.species.herbivore, heavyDrift)
        expect(Number.isFinite(child.maxSpeed)).toBe(true)
        expect(child.maxSpeed).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(child.baseMetabolicRate)).toBe(true)
        expect(child.baseMetabolicRate).toBeGreaterThan(0)
      }
    })

    it('clamps efficiency to [0.1, 0.99]', () => {
      const heavyDrift = makeConfig({
        mutationRates: {
          ...cfg.mutationRates,
          statDrift: 1.0,
          statDriftSigma: 5.0, // huge drift to test clamping
        },
      })
      for (let seed = 1; seed <= 100; seed++) {
        const child = mutateStats(makeRng(seed), cfg.species.herbivore, heavyDrift)
        expect(child.efficiency).toBeGreaterThanOrEqual(0.1)
        expect(child.efficiency).toBeLessThanOrEqual(0.99)
      }
    })

    // Issue #10 follow-up: ageDeathVariability clamping (*BF:Merian*)
    it('clamps ageDeathVariability to [0.05, 0.7] after drift', () => {
      const heavyDrift = makeConfig({
        mutationRates: {
          ...cfg.mutationRates,
          statDrift: 1.0,
          statDriftSigma: 5.0, // huge drift to push past bounds
        },
      })
      for (let seed = 1; seed <= 100; seed++) {
        const child = mutateStats(makeRng(seed), cfg.species.herbivore, heavyDrift)
        expect(child.ageDeathVariability).toBeGreaterThanOrEqual(0.05)
        expect(child.ageDeathVariability).toBeLessThanOrEqual(0.7)
      }
    })

    it('does not mutate the parent stats', () => {
      const parent = cfg.species.herbivore
      const parentSnapshot = JSON.stringify(parent)
      const heavyDrift = makeConfig({
        mutationRates: { ...cfg.mutationRates, statDrift: 1.0, statDriftSigma: 0.2 },
      })
      mutateStats(makeRng(42), parent, heavyDrift)
      expect(JSON.stringify(parent)).toBe(parentSnapshot)
    })
  })
})
