import { describe, it, expect } from 'vitest'
import { makeSim } from '../src/core/sim.js'
import { makeConfig } from '../src/core/config.js'
import { makeRng } from '../src/core/rng.js'

/**
 * Energy conservation fuzz test — Story 5.2
 *
 * The definitive proof that BioForge conserves energy across a wide range of
 * seeds and tick counts.
 *
 * Spec §16.6: "Energy conservation fuzz test: multiple seeds × 5000 ticks,
 * Number.isFinite on every value"
 * Spec §2: The hard invariant — total system energy is constant.
 *
 * Performance budget: 60s total.
 * 1000 ticks ≈ 2s per seed. 10 seeds × 5000 ticks ≈ 50s — within budget.
 * Per-entity finiteness checked every 10th tick (500 checks × 10 seeds = 5000
 * per-entity sweeps). Conservation checked at every tick (50,000 asserts).
 *
 * AC5.2.1: 10 seeds × 5000 ticks = 50,000 total tick-asserts
 * AC5.2.2: total energy within ENERGY_EPSILON of cfg.totalEnergy at every tick
 * AC5.2.3: living entity fields finite at every sampled tick
 * AC5.2.4: dead matter energies finite and >= 0 (via ledger.assertFinite)
 * AC5.2.5: completes in under 60 seconds
 */

// 10 seeds covering a spread of RNG states
const SEEDS = [1, 7, 42, 99, 123, 256, 444, 777, 999, 4567]
const TICKS = 5000
const ENTITY_CHECK_INTERVAL = 10

describe('AC5.2.1-5 — energy conservation fuzz', () => {
  for (const seed of SEEDS) {
    it(`seed ${String(seed)}: ${String(TICKS)} ticks — conservation + finiteness`, () => {
      const cfg = makeConfig({ seed })
      const rng = makeRng(seed)
      const sim = makeSim(cfg, rng)
      const initialTotalEnergy = sim.state.totalEnergy

      for (let t = 0; t < TICKS; t++) {
        sim.tick()

        // AC5.2.2: energy conservation at every tick
        expect(sim.state.totalEnergy).toBeCloseTo(initialTotalEnergy, 4)

        // AC5.2.3 + AC5.2.4: per-entity finiteness every ENTITY_CHECK_INTERVAL ticks
        if (t % ENTITY_CHECK_INTERVAL === 0) {
          // AC5.2.3: living entity fields
          for (const entity of sim.state.entities.values()) {
            if (!Number.isFinite(entity.position.x)) {
              throw new Error(
                `seed=${String(seed)} tick=${String(t)} entity#${String(entity.id)} position.x is not finite: ${String(entity.position.x)}`,
              )
            }
            if (!Number.isFinite(entity.position.y)) {
              throw new Error(
                `seed=${String(seed)} tick=${String(t)} entity#${String(entity.id)} position.y is not finite: ${String(entity.position.y)}`,
              )
            }
            if (!Number.isFinite(entity.velocity.x)) {
              throw new Error(
                `seed=${String(seed)} tick=${String(t)} entity#${String(entity.id)} velocity.x is not finite: ${String(entity.velocity.x)}`,
              )
            }
            if (!Number.isFinite(entity.velocity.y)) {
              throw new Error(
                `seed=${String(seed)} tick=${String(t)} entity#${String(entity.id)} velocity.y is not finite: ${String(entity.velocity.y)}`,
              )
            }
            if (!Number.isFinite(entity.energy)) {
              throw new Error(
                `seed=${String(seed)} tick=${String(t)} entity#${String(entity.id)} energy is not finite: ${String(entity.energy)}`,
              )
            }
            if (!Number.isFinite(entity.wasteBuffer)) {
              throw new Error(
                `seed=${String(seed)} tick=${String(t)} entity#${String(entity.id)} wasteBuffer is not finite: ${String(entity.wasteBuffer)}`,
              )
            }
          }

          // AC5.2.4: dead matter finiteness via ledger (covers all corpse/poop/compost pools)
          sim.assertFinite()
        }
      }

      // Final conservation assertion
      sim.assertEnergyConserved()
    }, 65_000) // 65s timeout per test — generous buffer above the 60s budget
  }
})
