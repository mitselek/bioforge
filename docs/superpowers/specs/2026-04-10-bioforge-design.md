# BioForge — Design & Specification

*Version 0.1 — 2026-04-10*
*Status: draft for PO review*
*Companion document: `docs/WORKFLOW.md`*

---

## 0. Purpose and shape of this document

BioForge is a terminal-based ecosystem simulation rendered in ASCII. Four species (plants, herbivores, carnivores, decomposers) interact on a torus-topology 2D world under a hard energy-conservation invariant. Each creature's behavior is driven by a small Turing-machine genome that mutates across generations.

This document is the authoritative answer to "what are we building." It does not describe *how* we work together — that is in `docs/WORKFLOW.md`. Module layout, public types, and subsystem responsibilities live here. Implementation details below the signature level do not.

**Target reader**: the RED agent needs this document to write acceptance tests from; the GREEN and PURPLE agents need it to stay honest about scope; the PO needs it to check that their intent survived translation.

---

## 1. World and topology

### 1.1 Geometry

- The world is a **2D continuous space** of dimensions `WORLD_W × WORLD_H` in arbitrary world-units.
- **Defaults**: `WORLD_W = 80.0`, `WORLD_H = 30.0` (world-units).
- Positions are `{x: number, y: number}` with `x ∈ [0, WORLD_W)` and `y ∈ [0, WORLD_H)`.
- Orientations are angles in radians, normalized to `[-π, π]`.

### 1.2 Torus wrap-around

- Crossing any edge places the entity at the opposite edge. Implemented as modular arithmetic (`((x % W) + W) % W`) — no `while` loops, no conditional branches per coordinate.
- **Distance between two points is always the shortest path across the torus**. For two points `p` and `q`:

  ```
  dx = wrapDelta(p.x - q.x, WORLD_W)
  dy = wrapDelta(p.y - q.y, WORLD_H)
  dist = sqrt(dx² + dy²)
  ```

  where `wrapDelta(d, size)` returns `d - round(d / size) * size` (in `[-size/2, size/2]`).
- All distance, direction, and sensing math must use this wrap-aware helper. No entity can "see" a target more than `min(WORLD_W, WORLD_H) / 2` units away, because anything further is closer from the other direction.

### 1.3 Orientation normalization

- Angles are normalized using `Math.atan2` or `angle - 2π * round(angle / 2π)` — never with a `while (a > π) a -= 2π` loop, which freezes at very large angles.

### 1.4 Module responsibility

All world geometry (positions, angles, distances, wrap math) lives in `src/core/world.ts`. No other module re-implements wrap logic.

---

## 2. Energy conservation — the hard invariant

This is the single most important rule in the codebase. Everything else bends to serve it.

### 2.1 The law

**Total system energy is constant.** At every tick, after every step, at every observable moment:

```
Σ(living entities) + Σ(corpses) + Σ(poop) + Σ(compost) + soilNutrients == TOTAL_ENERGY
```

**Default**: `TOTAL_ENERGY = 100_000`.

No energy is ever created. No energy is ever deleted. Metabolism, movement costs, inefficiency — all of these move energy from one pool to another, but never out of the system.

### 2.2 Energy pools

There are exactly five kinds of energy pool:

```ts
type EnergyPool =
  | { kind: 'entity';  id: EntityId }    // living creature
  | { kind: 'corpse';  id: CorpseId }    // dead body
  | { kind: 'poop';    id: PoopId }      // non-decomposer waste
  | { kind: 'compost'; id: CompostId }   // decomposer waste
  | { kind: 'soil' }                     // ambient nutrient field (global)
```

There is deliberately no `'void'` pool. TypeScript prevents any code from deleting energy because there is nowhere for it to go.

### 2.3 The ledger

All energy movement goes through a single function:

```ts
transfer(from: EnergyPool, to: EnergyPool, amount: number): void
```

- `amount` must be non-negative and finite
- The ledger debits `from` by `amount` and credits `to` by `amount`
- In dev mode, the ledger asserts `Number.isFinite(amount) && amount >= 0`
- In dev mode, the ledger asserts the sum of all pools equals `TOTAL_ENERGY` after the transfer
- There is no "silent subtract." If a piece of code wants to remove energy from a creature, it must name a destination pool.

### 2.4 How metabolism uses the ledger

When a creature burns energy for metabolism or movement:

1. The cost is transferred from the creature into the creature's **internal waste buffer**.
2. The waste buffer is part of the creature's entity record — it counts toward `entity` pool total, not separately.
3. When the waste buffer crosses a threshold (`10.0` for non-decomposers), it is materialized:
   - Non-decomposers drop a **poop** at the creature's current position. The 10 units transfer from the entity to the poop.
   - Decomposers drop **compost** instead of poop. The 10 units transfer from the entity to the compost.

This means a creature's visible energy decreases over time even while idle, but the energy is still conserved inside the waste buffer until it's deposited.

### 2.5 Invariant enforcement points

- **Compile time**: the `EnergyPool` type has no `void` variant. Deleting energy is unrepresentable.
- **Runtime (dev)**: after every `transfer`, and after every full tick, `assertEnergyConserved()` runs. Drift > `ENERGY_EPSILON = 1e-6` (absolute tolerance) throws. This is loose enough to tolerate float64 rounding across thousands of ticks while tight enough to catch real logic errors (1 ppm of `TOTAL_ENERGY`).
- **Runtime (dev)**: `assertFinite()` runs on every position, velocity, and energy value every tick. Any `NaN` or `Infinity` throws immediately, identifying the offending entity.
- **Test suite**: the **energy fuzz test** runs the simulation for 5000 ticks × 20 random seeds, asserting the invariant at every tick. This test is part of the Layer 2 per-commit gates.

### 2.6 Module responsibility

`src/core/energy.ts` owns:
- `EnergyPool` type
- `transfer()` and the internal pool table
- `totalEnergy()` and `assertEnergyConserved()`
- `assertFinite()` runtime guard
- No other module touches energy without going through this module.

---

## 3. The four species

All four species share the entity base type:

```ts
type Species = 'plant' | 'herbivore' | 'carnivore' | 'decomposer'

type Entity = {
  id: EntityId
  species: Species
  position: Vec2              // defined in src/core/world.ts
  velocity: Vec2              // zero for plants
  orientation: number         // radians, normalized to [-π, π]
  energy: number              // the creature's usable energy; >= 0
  wasteBuffer: number         // accumulated metabolic waste, >= 0
                              // counts toward the same `entity` pool as `energy`;
                              // deposited as poop/compost when it crosses POOP_THRESHOLD
  age: number                 // ticks since birth
  lifespan: number            // ticks total (inherited, mutable, per §8)
  maturityAge: number         // ticks until reproductive; < lifespan (safeguarded)
  lastReproTick: number       // tick of most recent birth (−∞ if never); used for cooldown
  genome: Genome              // see Section 7
  lastSense: SenseResult      // see Section 7.5; initialized to NO_SENSE (see §7.6)
  stats: SpeciesStats         // per-species tunables, inherited with mutation
}
```

Where `EntityId`, `CorpseId`, `PoopId`, `CompostId` are branded numeric types defined in `src/core/entity.ts` and `src/core/deadMatter.ts`. `Vec2` is `{x: number, y: number}` defined in `src/core/world.ts`.

### 3.1 Plants

- **Role**: primary producers. Convert soil nutrients into living biomass.
- **Velocity**: always zero. Plants do not move.
- **Orientation**: irrelevant but tracked as 0 for uniformity.
- **Energy absorption**: every tick, a plant absorbs up to `stats.absorbRate` energy from `soil` via `transfer(soil, plant, amount)`, bounded by soil's available energy. Absorption is faster when a compost is within `COMPOST_RADIUS` world-units: the effective absorb rate is multiplied by `(1 + COMPOST_BOOST × nearbyCompostCount)`, capped at `COMPOST_BOOST_CAP` (default 3.0×). Nearby compost is **not** consumed by absorption — it only accelerates it.
- **Spawning**: new plants spawn probabilistically near compost. Each tick, for each compost, with probability `PLANT_SPAWN_BASE_PROB × 4.0`, a new plant appears within `COMPOST_SPAWN_RADIUS` of the compost. The compost is **consumed** by the spawning event: its full energy transfers to the new plant via `transfer(compost, newPlant, compost.energy)`. The new plant's starting energy is then augmented from soil up to `stats.initialEnergy` if soil has capacity: `transfer(soil, newPlant, min(stats.initialEnergy - newPlant.energy, soil.energy))`. If soil is exhausted, the new plant simply starts with whatever the compost contributed. The compost record is then removed.
- **Genome**: plants have a genome but it is largely inert — plants do not move, so `MOVE_FORWARD`, `TURN_*` instructions are no-ops. `SENSE_*` instructions still execute and populate `lastSense` (used for display; plants do not act on sense results). This keeps the data model uniform across species and allows mutation to potentially "promote" a plant's offspring toward motility if we ever add that (for now: it cannot).
- **Death**: when `energy <= 0` (starvation), `age >= lifespan` (old age), or eaten to zero by a herbivore (predation), the plant dies. A **corpse** is created at the plant's position containing the plant's **remaining energy at the moment of death** (same rule as every other species — energy is never created or destroyed). Note: `PLANT_INITIAL_BIOMASS = 50` is the *starting* energy of a new plant (at seeding or compost-spawning), not a corpse-size invariant. Plants may grow above 50 by absorbing soil, or shrink below 50 before dying.
- **Reproduction**: plants reproduce **only** via compost-adjacent spawning (above). They do NOT use the standard §6.3 reproduction rule. This keeps the "plants are stationary primary producers" concept clean and prevents a free growth-then-split exploit.

### 3.2 Herbivores

- **Role**: mobile primary consumers. Eat plants.
- **Behavior source**: genome VM (Section 7).
- **Eating**: when a herbivore's body overlaps a plant (distance < `herbivore.radius + plant.radius`), it consumes the plant gradually at rate `stats.eatRate` energy/tick of contact. Eating follows the unified predation model in §3.5: the herbivore gains `eaten × efficiency`, the remaining `eaten × (1 − efficiency)` goes into the herbivore's waste buffer (later becoming poop). When the plant's energy reaches zero, the plant dies as predation and a corpse is created at its location containing any remaining plant energy (per §3.1, this is typically zero after full consumption — the "corpse on predation" is the living-entity predation rule from §3.5, which for plants is usually empty).
- **Death**: starvation (`energy <= 0`) or old age. Corpse created at position containing the herbivore's remaining energy.

### 3.3 Carnivores

- **Role**: apex predators. Eat herbivores.
- **Behavior source**: genome VM.
- **Hunting**: when a carnivore's body overlaps a herbivore (distance < `carnivore.radius + herbivore.radius`), it attacks. Carnivore eating is a single-tick event: the entire prey energy is consumed in one tick (the unified predation model from §3.5 with `amountEatenThisTick = prey.energy`). Of that, `efficiency × prey.energy` is transferred into the carnivore's own energy; the inefficiency portion `(1 − efficiency) × prey.energy` goes into the carnivore's waste buffer (later becoming poop). After this, the prey dies as predation; because all of the prey's energy was consumed, the resulting corpse is empty and is created with zero energy (handled below in §3.5 — empty corpses may be elided).
- **Efficiency**: default `efficiency = 0.6`.
- **Death**: starvation or old age. Corpse contains the carnivore's remaining energy.

### 3.4 Decomposers

- **Role**: scavengers. Eat corpses and poop. Return energy toward primary producers via compost.
- **Behavior source**: genome VM (yes, decomposers mutate too).
- **Eating**: decomposers eat when in contact with a **corpse** or **poop**. Consumption follows the unified predation model (§3.5) with `stats.eatRate` = 1.67 energy/tick of contact — which corresponds to the original spec's "≈50 energy/second" at the 30 Hz base tick rate. Multiple decomposers touching the same corpse/poop each take their own `eatRate` share, so the dead matter drains faster when several share it.
- **Efficiency**: decomposers are efficient (`stats.efficiency = 0.9`); the 10% loss goes into the decomposer's `wasteBuffer` as usual, later becoming compost.
- **Waste**: decomposers excrete **compost** instead of poop. Both metabolic-loss waste and the inefficiency portion of consumed food are compost. This is the only exception to the "non-decomposers drop poop" rule.
- **Death**: starvation or old age. Corpse contains remaining energy (decomposer corpses can be consumed by other decomposers).

### 3.5 Unified predation model

To keep the energy math honest and avoid per-species special cases, all "A eats B" events follow the same shape:

```
onEat(eater, food, amountEatenThisTick):
  # 1. All `amountEatenThisTick` energy moves from food to eater via the ledger.
  transfer(food, eater, amountEatenThisTick)

  # 2. The eater's energy is then split internally: a `gain` portion stays
  #    as usable energy; a `loss` portion is moved into the eater's wasteBuffer.
  #    This is a pure sub-field update inside the `entity` pool — no ledger
  #    transfer, because both `entity.energy` and `entity.wasteBuffer` belong
  #    to the same energy pool.
  loss = amountEatenThisTick * (1 - eater.stats.efficiency)
  eater.energy      -= loss
  eater.wasteBuffer += loss
```

**Notes:**
- The ledger `transfer` moves whole `amountEatenThisTick` into the eater. The efficiency split is an internal accounting move within the eater's entity pool — it does not go through the ledger because no energy leaves the pool.
- When `food.energy` reaches zero:
  - If `food` is a *living entity*, it dies as predation. A corpse is created at its position containing any remaining energy (for carnivore kills this is zero; for gradual herbivore eating this is typically zero; the corpse creation path handles the zero case gracefully and may elide empty corpses for cleanliness).
  - If `food` is a *corpse* or *poop* (decomposer eating), the dead-matter item is removed.
- The eater's `wasteBuffer` may exceed `POOP_THRESHOLD` as a result — waste deposition in step 8 of the tick loop (§10) handles the threshold check and drops poop/compost accordingly.

### 3.6 Per-species stats (`SpeciesStats`)

All inheritable, all mutable. Defaults:

| stat | plant | herbivore | carnivore | decomposer |
|---|---|---|---|---|
| `radius` (world units) | 0.4 | 0.5 | 0.7 | 0.4 |
| `maxSpeed` (world-units/second) | 0.0 | 1.2 | 1.8 | 0.8 |
| `baseMetabolicRate` (energy/tick) | 0.01 | 0.05 | 0.10 | 0.02 |
| `moveCostLinear` (coeff on speed) | 0.0 | 0.02 | 0.03 | 0.02 |
| `moveCostQuadratic` (coeff on speed²) | 0.0 | 0.04 | 0.06 | 0.03 |
| `eatRate` (energy/tick of contact) | — | 5.0 | 10000.0 *(effectively full prey in one tick)* | 1.67 |
| `absorbRate` (energy/tick, plants only) | 2.0 | — | — | — |
| `efficiency` | — | 0.7 | 0.6 | 0.9 |
| `lifespanMean` (ticks) | 1200 | 900 | 1500 | 1000 |
| `maturityAgeMean` (ticks) | 400 | 300 | 500 | 300 |
| `reproThresholdEnergy` | *(n/a — see §3.1)* | 150.0 | 250.0 | 100.0 |
| `reproCostFraction` | *(n/a)* | 0.5 | 0.5 | 0.5 |
| `initialEnergy` (at seeding) | 50 | 100 | 200 | 80 |

**Notes on the table:**
- `eatRate` for carnivores is set to a large finite value (not `Infinity`) so the unified eat function in §3.5 clamps naturally: `amountEatenThisTick = min(eatRate, food.energy)` reduces to `food.energy` for any prey smaller than 10000. Using a finite number keeps arithmetic and mutation drift well-defined.
- `absorbRate` is plant-specific; mobile species have no direct soil access.
- Plants have no `reproThresholdEnergy` or `reproCostFraction` because they do not use the standard reproduction rule (§3.1); they reproduce only via compost-adjacent spawning.
- `reproCostFraction`: the parent transfers this fraction of its energy to the offspring at birth.
- Lifespan and maturity age are drawn at birth from a normal distribution around the `*Mean` with small variance, then clamped to ensure `maturityAge < lifespan - MIN_REPRO_WINDOW`.

All values are tunable via `src/core/config.ts`. The UI exposes `baseMetabolicRate` per-species as a slider (spec requirement).

---

## 4. Dead matter

Three kinds, all distinct pool types, all rendered distinctly.

### 4.1 Corpses

- **Created by**: any death (starvation, old age, predation). Creation path handles the zero-energy case gracefully: corpses with zero energy are not added to the world.
- **Contents**: energy equal to the deceased's remaining energy at the moment of death. No species-specific top-up.
- **Decay**: slowly return energy to `soil` via the ledger at rate `CORPSE_DECAY_RATE` (tunable, default 1.0 energy/tick). When energy reaches zero, the corpse is removed.
- **Consumption**: decomposers eat corpses directly per §3.5. Decay and decomposer consumption are independent; both move energy out of the corpse each tick.
- **Rendering**: a square glyph, e.g., `■`, colored dimly.

### 4.2 Poop

- **Created by**: non-decomposers when their `wasteBuffer` crosses `POOP_THRESHOLD = 10.0` during waste deposition (§5.3).
- **Position**: dropped at the creature's current position.
- **Contents**: the full value of `wasteBuffer` at the moment of deposition (typically ≥ `POOP_THRESHOLD` — the waste buffer is drained completely, not just the threshold amount; see §5.3 rationale).
- **Decay**: **does not decay** by default. `POOP_DECAY_RATE` defaults to 0.0, but is tunable.
- **Consumption**: decomposers eat poop per §3.5. (Plants do not — plants only absorb from soil and compost.)
- **Rendering**: a small dot glyph, e.g., `.`, colored brown.

### 4.3 Compost

- **Created by**: decomposers when their `wasteBuffer` crosses `POOP_THRESHOLD`. All decomposer waste — metabolic loss, movement cost, and the inefficiency portion of eaten food — accumulates in the same `wasteBuffer` and is deposited together. Decomposers only ever deposit compost, never poop.
- **Position**: dropped at the decomposer's current position.
- **Contents**: the full value of `wasteBuffer` at the moment of deposition (same rule as poop in §4.2).
- **Decay**: **does not decay**. Persists until consumed by a plant or used for plant spawning.
- **Consumption**: plants spawn near compost (consuming it) and absorb-boost from nearby compost (not consuming it, just accelerating absorption).
- **Rendering**: a diamond glyph, e.g., `♦`, colored green-ish.

### 4.4 Module responsibility

`src/core/deadMatter.ts` owns corpse, poop, and compost types and their lifecycle (creation, decay, consumption hooks). Decomposer eating logic lives in `src/core/decomposition.ts`.

---

## 5. Metabolism and movement

### 5.1 Base metabolism

Every tick, every living entity burns `stats.baseMetabolicRate` energy. This is transferred from the entity into its own `wasteBuffer` (staying within the `entity` pool for bookkeeping, but the entity's *visible* energy decreases).

### 5.2 Movement cost

Movement cost is a drag-like model:

```
moveCost(speed) = stats.moveCostLinear * speed + stats.moveCostQuadratic * speed²
```

Applied every tick based on the entity's *actual* speed this tick (not target speed). Static entities pay zero movement cost.

The quadratic term is the reason "zooming around" is expensive relative to idling: doubling speed more than doubles the cost. This creates selection pressure toward energy-efficient behaviors.

### 5.3 Waste deposition

When `wasteBuffer >= POOP_THRESHOLD`:

1. Amount to deposit: `wasteBuffer`
2. For non-decomposers: create a new `poop` at position; `transfer(entity, poop, amount)`; set `wasteBuffer = 0`
3. For decomposers: create a new `compost` at position; `transfer(entity, compost, amount)`; set `wasteBuffer = 0`

The "amount" is the full waste buffer, not just the threshold — otherwise waste accumulates faster than it drops.

### 5.4 Module responsibility

`src/core/metabolism.ts` owns base metabolism, movement cost computation, and waste deposition. Movement cost coefficients are per-species in `stats`, tunable via config.

---

## 6. Life cycle

### 6.1 Birth

Entities are created by:
- Initial seeding (see Section 17)
- Reproduction (Section 6.3)
- Plant spawning near compost (Section 3.1)

At birth, an entity gets:
- Random position (for initial seeding) or parent's position (for reproduction; offspring is placed at parent's position plus a small random offset to avoid immediate collision)
- `age = 0`
- `lifespan` drawn from normal distribution around parent's `lifespan` (inherited with mutation)
- `maturityAge` drawn from normal distribution around parent's `maturityAge`
- **Safeguard**: if `maturityAge >= lifespan - MIN_REPRO_WINDOW`, clamp `maturityAge = lifespan - MIN_REPRO_WINDOW`. Default `MIN_REPRO_WINDOW = 100` ticks.
- Genome inherited with mutation (Section 8)
- Stats inherited with mutation
- Starting energy: from reproduction cost or initial seeding

### 6.2 Aging

Every tick, `entity.age += 1`. When `age >= lifespan`, the entity dies of old age.

### 6.3 Reproduction

This rule applies to **herbivores, carnivores, and decomposers** only. Plants reproduce exclusively via compost-adjacent spawning (§3.1) and never use this path.

Reproduction is **genome-driven**: it only happens when the entity's genome executes a `REPRODUCE` opcode (§7.1) AND the eligibility conditions below are all satisfied. If the genome never emits `REPRODUCE`, the entity never reproduces — evolution has to discover reproduction timing as part of the learned behavior.

**Eligibility conditions (all must hold when `REPRODUCE` executes):**
1. `age >= maturityAge` (mature)
2. `energy >= stats.reproThresholdEnergy` (well-fed)
3. Reproduction cooldown has elapsed: `currentTick - lastReproTick >= REPRO_COOLDOWN_TICKS` (default 200)

If any condition fails when `REPRODUCE` executes, the opcode is a no-op for that tick (no state change, no energy cost). The cooldown prevents runaway "reproduce every tick" strategies from escaping natural selection.

**Reproduction process** (executed in step 9 of the tick loop for queued requests from this tick's VM step):
1. Compute offspring energy: `offspringEnergy = parent.energy * stats.reproCostFraction`
2. Create a new `entity` pool for the child: `transfer(parent, child, offspringEnergy)`
3. Child inherits genome, stats, lifespan, maturityAge — each with mutation per §8
4. Parent's `lastReproTick` is set to `currentTick`
5. Child is placed at parent's position plus a small random offset (avoids immediate collision with parent; first physics step resolves any residual overlap)

**Why genome-driven, not automatic:** giving the genome control over reproduction timing creates richer selection pressure. A genome that reproduces the instant it becomes eligible may exhaust its energy and die; a genome that waits for abundance may outcompete it. Evolution can discover both strategies. The cooldown, threshold, and maturity gates are the hard safety rails that prevent any genome from trivially dominating.

### 6.4 Death

Death causes:
- **Starvation**: `energy <= 0`
- **Old age**: `age >= lifespan`
- **Predation**: killed by a predator (Section 3.3–3.5)

All deaths create a corpse. Energy is conserved via ledger transfers.

### 6.5 Module responsibility

`src/core/lifecycle.ts` owns aging, reproduction eligibility, birth construction, and death resolution. It calls into `energy.ts` for all transfers and into `genome.ts` for genome mutation.

---

## 7. Genome — the Turing-tape VM

### 7.1 Representation

```ts
type Genome = {
  tape: Instruction[]
  ip: number              // instruction pointer, always valid index into tape
}

type Instruction =
  | { op: 'MOVE_FORWARD'; arg1: number }                       // arg1 ∈ [0,1]
  | { op: 'TURN_LEFT';    arg1: number }                       // arg1 ∈ [0,1]
  | { op: 'TURN_RIGHT';   arg1: number }                       // arg1 ∈ [0,1]
  | { op: 'SENSE_FOOD';     arg1: number; arg2: number }       // arg1 ∈ [0,1] → angle spread; arg2 ∈ [0,1] → range
  | { op: 'SENSE_PREDATOR'; arg1: number; arg2: number }
  | { op: 'SENSE_MATE';     arg1: number; arg2: number }
  | { op: 'JUMP_IF_TRUE';  arg1: number; target: number }      // target is resolved modulo tape length
  | { op: 'JUMP_IF_FALSE'; arg1: number; target: number }
  | { op: 'REPRODUCE';     arg1: number }                      // arg1 ∈ [0,1] (currently unused; reserved for future)

type Opcode = Instruction['op']
```

Nine opcodes total. `REPRODUCE` is a genome-driven action: when executed it *requests* reproduction, which only actually happens if the eligibility conditions in §6.3 hold (mature, above threshold, cooldown elapsed). If the request cannot be honored, `REPRODUCE` is a no-op for that tick. This gives evolution control over *timing* of reproduction while the static eligibility rules prevent runaway.

- `arg1`, `arg2`, and all scalar args are real-valued in `[0, 1]`. This lets mutation drift smoothly.
- Angle spread is computed as `arg1 * 2π` (`arg1 = 1` means 360° = full omnidirectional).
- Range is computed as `arg2 * MAX_SENSE_RANGE` where `MAX_SENSE_RANGE` is a per-species tunable (default ~15 world units — less than half the smaller world dimension to avoid wrap-around ambiguity).
- `target` for jumps is an integer; on mutation it can shift by ±1 or jump randomly; at execution time it is taken `mod tape.length`.

### 7.2 Initial genomes

When an entity is created from scratch (not by reproduction):
- `tape.length` chosen uniformly at random in `[6, 16]`
- Each instruction is chosen with a **biased** distribution to ensure new entities have at least basic if-then reflexes *and* some reproductive drive:
  - 28% chance: a `SENSE_*` instruction (food, predator, mate — each at ~9.3%)
  - 18% chance: a `JUMP_IF_*` instruction (true, false — each at 9%)
  - 18% chance: `MOVE_FORWARD`
  - 18% chance: `TURN_LEFT` or `TURN_RIGHT` (9% each)
  - 8% chance: `REPRODUCE` (guarantees most generation-0 genomes carry at least one repro attempt, but not so often that it dominates)
  - 10% chance: random choice from all nine opcodes (uniform)
- All args uniform in `[0, 1]`
- Jump targets uniform integers in `[0, tape.length - 1]`
- `ip = 0`

### 7.3 Execution

Each tick, an entity executes **one instruction**, advances `ip`, and wraps `ip` around tape length.

- `MOVE_FORWARD(arg1)`: set desired speed to `arg1 * stats.maxSpeed`. Physics will integrate this next step. No-op for plants (they never move).
- `TURN_LEFT(arg1)`: rotate orientation by `-arg1 * TURN_RATE * dt`. Time-based, frame-rate independent. No-op for plants.
- `TURN_RIGHT(arg1)`: rotate orientation by `+arg1 * TURN_RATE * dt`. No-op for plants.
- `SENSE_FOOD(arg1, arg2)`, `SENSE_PREDATOR`, `SENSE_MATE`: see §7.5.
- `JUMP_IF_TRUE(arg1, target)`, `JUMP_IF_FALSE(arg1, target)`: see §7.6.
- `REPRODUCE(arg1)`: attempt genome-driven reproduction per §6.3. The VM calls the reproduction eligibility check; if it passes, a child entity is created *in the reproduction step of the next tick* (queued, not immediate — reproduction bookkeeping runs in tick step 9). If eligibility fails (not mature, not enough energy, cooldown active), `REPRODUCE` is a no-op for this tick. **No-op for plants** — plant reproduction goes entirely through compost-adjacent spawning (§3.1). `arg1` is currently unused and reserved for future use (e.g., investment fraction).

`TURN_RATE` default: `π` radians/second (half-turn per second at full arg).

### 7.4 IP advancement

After executing the instruction (jumps excepted), `ip = (ip + 1) mod tape.length`. Jumps may set `ip` to `target mod tape.length` directly.

### 7.5 Sensing

`SENSE_*` queries the world for the nearest matching target within a cone:

```
SENSE_FOOD(arg1, arg2):
  spread  = arg1 * 2π         // full cone angle
  range   = arg2 * MAX_SENSE_RANGE
  target  = nearest entity matching "food-for-this-species"
            whose position is within `range` world units
            AND whose bearing is within `spread/2` of current heading
```

"Food-for-this-species":
- Herbivore → plant
- Carnivore → herbivore
- Decomposer → corpse | poop
- Plant → always returns "not detected" (plants don't eat, they absorb)

"Predator-for-this-species":
- Herbivore → carnivore
- Carnivore → (nothing, apex) → always "not detected"
- Decomposer → (nothing) → always "not detected"
- Plant → always "not detected"

"Mate-for-this-species":
- Herbivore, carnivore, decomposer → another mature entity of the same species
- Plant → always "not detected" (plants do not use mate sensing)

Mate sensing does not currently affect reproduction (which is asexual in v1 per §6.3), but the `lastSense` result is populated so the genome VM's conditional jumps can still react to mate proximity, and the UI inspector can display it.

**Return value** stored in `entity.lastSense`:

```ts
type SenseResult = {
  kind: 'food' | 'predator' | 'mate'
  angle: number            // radians relative to current heading; see below
  distance: number         // world units; 0 if not detected
  detected: boolean
  spread: number           // the arg1 used, for rendering the vision cone
  range: number            // the arg2 used
}
```

- Negative `angle` = target is to the left
- Positive `angle` = target is to the right
- Exactly `0` = **not detected** (sentinel)
- Tiny nonzero (±`EPSILON_AHEAD`, e.g., 1e-9) = directly ahead; sign is arbitrary (convention: positive)
- `detected` is the authoritative flag; `angle == 0` should be checked against `detected`, not used directly as a sentinel in arithmetic

### 7.6 Conditional jumps

`JUMP_IF_TRUE(arg1, target)` and `JUMP_IF_FALSE(arg1, target)` evaluate the **last sensing result** stored in `lastSense`. If no sense has been executed since the entity was born, `lastSense` is initialized at birth to:

```ts
const NO_SENSE: SenseResult = {
  kind: 'food',      // placeholder
  angle: 0,
  distance: 0,
  detected: false,
  spread: 0,
  range: 0,
}
```

The `arg1` value (in `[0, 1]`) selects the condition via **disjoint bands**, so mutation drifts smoothly between conditions without relying on exact-equality sentinels:

| `arg1` band | condition evaluated |
|---|---|
| `[0.00, 0.25)` | "anything detected" → `lastSense.detected` |
| `[0.25, 0.50)` | "nothing detected" → `!lastSense.detected` |
| `[0.50, 0.75)` | "target is to the left" → `lastSense.detected && lastSense.angle < 0` |
| `[0.75, 1.00]` | "target is to the right" → `lastSense.detected && lastSense.angle > 0` |

(The original spec used raw angle sentinels — `>0`, `<0`, `==0`, undefined — as the condition selector. We canonicalize all genome args to `[0, 1]` reals for smooth mutation drift, and represent the four conditions as four equal-width bands. This is evolvable: a small arg-drift mutation can nudge a genome from "nothing detected" into "target is left" without needing to hit a specific exact value.)

**Jump semantics:**
- `JUMP_IF_TRUE`: if the selected condition holds, `ip = target mod tape.length`. Otherwise `ip` advances normally (`ip = (ip + 1) mod tape.length`).
- `JUMP_IF_FALSE`: jumps if the selected condition does **not** hold; otherwise advances normally.

### 7.7 Module responsibility

`src/core/genome.ts` owns the `Genome`, `Instruction`, `Opcode`, `SenseResult` types, random genome generation, and mutation.

`src/core/vm.ts` owns the execution step — one tick, one instruction, side effects into the entity and (via `sensing.ts`) the world.

`src/core/sensing.ts` owns the world queries that `SENSE_*` uses. It is the only module in `core` that reads from the world's entity index for "what's near me" queries.

---

## 8. Mutation and inheritance

### 8.1 What is inherited

On reproduction, the offspring inherits:
- **Genome** — a *mutated copy* of the parent's genome (see 8.2)
- **Stats** — a *mutated copy* of `stats` (see 8.3)
- **Lifespan and maturity age** — drawn from a normal distribution around the parent's values; safeguarded (Section 6.1)

### 8.2 Genome mutation operators

Applied to the parent's tape to produce the offspring's tape. Each operator has an independent probability per tape:

- **Arg drift** (prob `MUT_ARG_DRIFT` per instruction, default 0.10): add a small Gaussian nudge (`σ = 0.05`) to one or both args, clamp to `[0, 1]`. Jump targets drift by `±1` with small probability.
- **Op swap** (prob `MUT_OP_SWAP` per tape, default 0.05): pick one random index, replace its opcode with a different random opcode, keeping args (filling in new args uniformly if opcode has different arity).
- **Insertion** (prob `MUT_INSERT` per tape, default 0.03): insert a random instruction at a random position. Tape length grows by 1. Capped at `MAX_TAPE_LENGTH = 64`.
- **Deletion** (prob `MUT_DELETE` per tape, default 0.03): delete an instruction at a random position. Tape length shrinks by 1. Floored at `MIN_TAPE_LENGTH = 2`.

All probabilities tunable. Mutation operators are independent and can stack in a single reproduction.

### 8.3 Stats mutation

Each numeric stat in `SpeciesStats` has an independent `MUT_STAT_DRIFT` (default 0.05) probability of mutation. When mutated, the value is multiplied by `exp(Gaussian(0, 0.1))` — lognormal drift, so positive values stay positive. Clamped to sane per-stat ranges (e.g., `maxSpeed >= 0`, `efficiency ∈ [0.1, 0.99]`).

### 8.4 Invariants maintained

- `maturityAge < lifespan - MIN_REPRO_WINDOW` always
- Tape length in `[MIN_TAPE_LENGTH, MAX_TAPE_LENGTH]` always
- All numeric stats finite and non-negative
- `efficiency` stays in `[0.1, 0.99]` (0.1 floor prevents species death by over-mutation; 0.99 ceiling prevents free lunch)

### 8.5 Module responsibility

Mutation logic lives in `src/core/genome.ts` (for genome) and `src/core/lifecycle.ts` (for stats, since birth construction already lives there).

---

## 9. Collisions

### 9.1 Detection

Two entities collide when `distance(a, b) < a.radius + b.radius` (using torus-aware distance).

### 9.2 Resolution

**Not a physics engine**, just a push-apart:
1. Compute penetration depth `p = (a.radius + b.radius) - distance(a, b)`
2. Compute unit normal from `a` to `b` (wrap-aware)
3. Move each entity by `p/2` in opposite directions along the normal
4. Velocities are **not** changed; this is purely positional

Plants do not push — they are stationary. If a plant is involved, the other entity absorbs the full push distance.

### 9.3 Interactions-on-contact

Collision is also the trigger for:
- Herbivore eating plant (contact starts gradual eating)
- Carnivore attacking herbivore (contact = instant attack)
- Decomposer eating corpse/poop (contact starts gradual eating)

These interactions are resolved **after** collision resolution, in Step 5 of the tick loop (see Section 10). The order matters: collision first so entities aren't overlapping when eating logic runs.

### 9.4 Spatial indexing

For performance at ~425 entities plus dead matter, collision and sensing queries use a **uniform grid** spatial index: the world is binned into cells of size `SENSE_MAX_RANGE × SENSE_MAX_RANGE`, each entity registers in its bin every tick, queries scan only 9 neighboring bins (including wrap-around neighbors). This is not clever but is more than enough for our scale and is easy to test.

### 9.5 Module responsibility

`src/core/physics.ts` owns collision detection and resolution plus the spatial index.

---

## 10. Tick update order

One tick = one call to `sim.tick(dt)`. `dt` defaults to `1/30` second but is scaled by the speed slider (Section 15). The steps run in this fixed order:

```
tick(dt):
  1. advance clock                — age++ for every living entity
  2. rebuild spatial index         — used by both sensing and physics
  3. genome VM step                — each entity executes one instruction (may set velocity, orientation, sense, or jump)
  4. physics: movement             — integrate velocity → position with torus wrap
  5. physics: collisions           — detect and resolve overlap
  6. metabolism                    — base + movement cost moved into wasteBuffer
  7. interactions                  — eating: herbivores↔plants, carnivores↔herbivores, decomposers↔corpses+poop
  8. waste deposition              — entities whose wasteBuffer >= POOP_THRESHOLD drop poop (non-decomposers) or compost (decomposers)
  9. reproduction (mobile species) — process `REPRODUCE` opcode requests queued by the VM step; eligible herbivores, carnivores, decomposers actually spawn offspring (plants do NOT use this step — see step 12)
 10. deaths                        — starvation, old age, predation resolved; corpses created (zero-energy corpses elided)
 11. decay                         — corpses return energy to soil at CORPSE_DECAY_RATE; compost and poop do not decay (default)
 12. plant lifecycle               — plants absorb soil (compost-boosted), and compost-adjacent plant spawning (§3.1) runs here if auto-spawn is on
 13. invariant check (dev only)    — assertEnergyConserved, assertFinite
```

### 10.1 Why this order

- **Step 2 before 3**: sensing queries need the spatial index up to date.
- **Step 3 before 4**: VM sets the *intent* (velocity, turn); physics then realizes it.
- **Step 5 before 7**: entities must not be overlapping when eating logic runs, otherwise who-eats-whom is ambiguous.
- **Step 6 before 8**: metabolism deposits into the waste buffer; waste deposition then checks the threshold.
- **Step 9 before 10**: a parent that is about to die this tick can still have one last child if eligibility holds at step 9 — this rewards creatures that reach reproduction threshold before starving. (We chose reproduction-before-death deliberately; the reverse is also defensible but gives a slightly different evolutionary pressure. Locked as reproduction-before-death.)
- **Step 10 before 11**: this-tick's deaths produce corpses *after* predation has been resolved; corpses become eligible for decay and decomposer eating starting *next* tick, preventing double-dipping.
- **Plant reproduction lives in step 12, not step 9**: plants do not use the standard reproduction rule (§3.1, §6.3). Compost-adjacent plant spawning runs in the plant-lifecycle step so it happens after soil has been enriched by decay.
- **Step 13 last**: invariant checks run after everything has settled. Any drift is localized to this tick and easy to debug.

### 10.2 Within-step ordering

Within each step, entity iteration order matters for reproducibility. Default: **iterate in ascending `entity.id` order**, which is deterministic and stable across ticks. This means test fuzz runs are exactly reproducible.

### 10.3 Module responsibility

`src/core/sim.ts` owns the tick loop orchestration. Each step delegates to its respective module. `sim.ts` is the *only* module in `core` that imports from all others.

---

## 11. Module layout

```
bioforge/
├── src/
│   ├── core/                       # Pure sim, zero UI deps, fully testable headless
│   │   ├── world.ts                # Torus topology + wrap-aware distance/angle helpers
│   │   ├── entity.ts               # Entity type, Species, SpeciesStats
│   │   ├── genome.ts               # Genome, Instruction, Opcode, mutation
│   │   ├── vm.ts                   # Genome VM execution (one tick = one instruction)
│   │   ├── sensing.ts              # SENSE_* world queries
│   │   ├── physics.ts              # Movement integration, collisions, spatial index
│   │   ├── metabolism.ts           # Base cost, drag model, waste deposition
│   │   ├── lifecycle.ts            # Aging, reproduction, birth construction, death resolution
│   │   ├── deadMatter.ts           # Corpse/poop/compost types and lifecycle
│   │   ├── decomposition.ts        # Decomposer eating + corpse decay
│   │   ├── plants.ts               # Plant absorb + compost-adjacent spawning
│   │   ├── energy.ts               # Ledger: transfer, invariant check, NaN guard
│   │   ├── rng.ts                  # Seeded PRNG (deterministic)
│   │   ├── clock.ts                # Fixed-timestep driver
│   │   ├── config.ts               # Tunable constants, per-species stats defaults
│   │   └── sim.ts                  # Public API: new Sim(config), .tick(dt), .state, events
│   ├── ui/                         # Terminal rendering + input, depends on core only
│   │   ├── layout.ts               # blessed screen + panel composition
│   │   ├── worldView.ts            # Raw ANSI rasterizer for the sim grid
│   │   ├── hud.ts                  # Soil / total energy / counts panel
│   │   ├── inspector.ts            # Selected entity + genome + vision cone overlay
│   │   ├── chart.ts                # Population dynamics panel (hand-rolled ASCII sparkline)
│   │   ├── input.ts                # Keyboard handling, selection
│   │   └── theme.ts                # Colors, glyphs per species, symbols for dead matter
│   └── main.ts                     # Entry: wire core + ui, start loop
├── tests/                          # Vitest, mirrors src/core/ structure
│   ├── world.test.ts
│   ├── energy.test.ts
│   ├── genome.test.ts
│   ├── vm.test.ts
│   ├── sensing.test.ts
│   ├── physics.test.ts
│   ├── metabolism.test.ts
│   ├── lifecycle.test.ts
│   ├── decomposition.test.ts
│   ├── plants.test.ts
│   ├── sim.test.ts                 # Integration: full sim spin-up
│   └── energyConservation.test.ts  # Invariant fuzz test
├── stories/                        # Story files, see WORKFLOW.md §3
├── docs/
│   ├── WORKFLOW.md                 # Team workflow & pipeline
│   └── superpowers/
│       └── specs/
│           └── 2026-04-10-bioforge-design.md  # This document
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── lefthook.yml
└── .prettierrc
```

**Hard rules:**
- `src/core/` never imports from `src/ui/`
- `src/core/` never imports from `blessed` or any terminal library
- `src/core/` never uses `Math.random` — always `rng.ts`
- `src/ui/` may import from `src/core/`
- `src/main.ts` is the only place that wires them together

---

## 12. Strict TypeScript

All details in `docs/WORKFLOW.md` §6 and in the `tsconfig.json` / `eslint.config.js` files. Highlights that are non-negotiable design decisions, not workflow preferences:

- **Discriminated unions** for `Species`, `Opcode`, `Instruction`, `EnergyPool`, `DeathCause`
- **Switch exhaustiveness enforced** — ESLint `@typescript-eslint/switch-exhaustiveness-check` errors out on any non-exhaustive switch on a union type, so adding a new species or opcode fails to compile everywhere it needs to be handled
- `noUncheckedIndexedAccess` — `genome.tape[i]` is `Instruction | undefined`, catching out-of-bounds bugs in the VM at compile time
- No `any`, no `!`, no `@ts-ignore`
- `Number.isFinite` guards every incoming numeric value (mostly at boundaries — RNG output, config loading, UI input)

---

## 13. Rendering (ASCII rasterization)

### 13.1 World → character grid

The continuous world is rasterized to a character grid of `RENDER_W × RENDER_H` cells. Default: `RENDER_W = 80`, `RENDER_H = 30` (1:1 with world units for the default world size). World coordinates map to cell indices via `floor(x)` and `floor(y)`, wrapped.

### 13.2 Cell contents and priority

Multiple things may occupy the same cell. Priority order for what gets drawn:

1. Selected entity (if cell contains it) — always drawn with highlight color
2. Living entities in priority: carnivore > herbivore > decomposer > plant (top of food chain = most visually salient)
3. Corpses
4. Compost
5. Poop
6. Empty (background, shown as a soil-nutrient-heatmap-dim color or plain space)

### 13.3 Glyphs (defaults, in `src/ui/theme.ts`)

| Kind | Glyph | Color |
|---|---|---|
| plant | `♣` or `*` | green |
| herbivore | `h` | yellow |
| carnivore | `C` | red |
| decomposer | `d` | magenta |
| corpse | `■` or `x` | dim gray |
| compost | `♦` or `+` | dim green |
| poop | `.` | brown |
| empty | ` ` | dim background (optionally a soil-nutrient heatmap) |
| vision cone overlay | darker bg on cells in the cone | — |
| dashed line to sensed target | `·` overlay | cyan |

Non-ASCII glyphs (`♣`, `♦`, `■`) require a Unicode-capable terminal. A fallback ASCII-only theme (`*`, `+`, `x`) is selectable via a config flag.

### 13.4 Vision cone and sense indicator

When an entity is selected, its vision cone and last sensed target are overlaid:
- The cone: cells within `spread/2` of heading and within `range` distance are painted with a darker background (or a different bg color). Uses the `lastSense.spread` and `lastSense.range` from the entity's most recent sense execution.
- The sight line: if `lastSense.detected`, draw a dashed line from entity to `(entity.position + normalized direction × lastSense.distance)` using Bresenham's line over the cell grid.

### 13.5 Rendering rate

World panel re-rasterizes at most 30 Hz (matching base tick rate). At higher speed slider settings, the sim runs many ticks per render frame; the rasterizer only draws the latest state. This keeps the terminal happy and decouples sim rate from frame rate.

### 13.6 Module responsibility

`src/ui/worldView.ts` owns rasterization and ANSI writing. It imports from `src/core/sim.ts` (read-only, via a `state` snapshot) and `src/ui/theme.ts`.

---

## 14. UI layout (blessed panels)

Target terminal size: **130 × 44 minimum**. Gracefully degrades on smaller (hides population chart first, then inspector, then HUD).

```
┌─ BioForge ─────────────────────────────────────────────┬─ HUD ──────────────────────┐
│                                                        │ Tick:      1234            │
│     [80 cols × 30 rows world panel, ASCII world]       │ Speed:     1.0x            │
│                                                        │ Total E:   100000.00       │
│                                                        │ Soil:       23456.12       │
│                                                        │                            │
│                                                        │ Plants:       247          │
│                                                        │ Herb:          97          │
│                                                        │ Carn:          38          │
│                                                        │ Decomp:        49          │
│                                                        │                            │
│                                                        │ Corpses:       12          │
│                                                        │ Compost:        4          │
│                                                        │ Poop:           7          │
│                                                        ├─ Population ───────────────┤
│                                                        │ P ▅▆▇█▇▆▅▆▇█               │
│                                                        │ H  ▃▄▅▅▄▃▃▄▅               │
│                                                        │ C   ▁▂▂▂▁▁▂▂               │
│                                                        │ D  ▂▂▃▃▃▃▂▂                │
├─ Inspector [entity #142, herbivore] ───────────────────┴─ Controls ─────────────────┤
│ Age: 127 / 450   (mature)   Last sense: food, -0.42 rad (24°) left, d=3.1            │
│ Genome [IP=4/12]:  SENSE_FOOD JUMP_IF_FALSE MOVE_FORWARD TURN_LEFT >SENSE_PRED ...    │
│                                                                                       │
│ space=pause  [/]=speed  hjkl=select  tab=cycle  p=plants  n=nan-debug  q=quit         │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### 14.1 Panels

- **World panel**: 80×30 cells, raw ANSI written via direct cursor positioning inside a `blessed.box`. Owns most of the redraw budget.
- **HUD panel** (top-right, ~28 cols × 16 rows): `blessed.box` with formatted text. Updated every render frame with tick count, speed, total energy (invariant visualization), soil, counts.
- **Population panel** (right side below HUD, ~28 cols × 8 rows): hand-rolled sparkline. Rolling window of 60 ticks per species. Toggleable between count-mode and energy-mode via `e`.
- **Inspector panel** (bottom, full width minus controls): shows selected entity details. When no selection, shows "No entity selected. Use hjkl to move cursor, enter to select."
- **Controls strip** (bottom one line): key bindings summary.

### 14.2 Responsive behavior

If terminal < 130 × 44:
- First, hide the population chart (HUD still shows counts, which is enough for mid-density info)
- If still too small, collapse the inspector to one line ("entity #N, species, IP")
- Below ~100 × 30, show an error and suggest resizing

---

## 15. Controls and configuration

### 15.1 Keyboard controls

| Key | Action |
|---|---|
| `space` | Pause / resume |
| `[` | Decrease speed slider (min 0.1×) |
| `]` | Increase speed slider (max 10×) |
| `r` | Reset simulation (with confirmation) |
| `q` | Quit |
| `h`/`j`/`k`/`l` or arrows | Move selection cursor in world |
| `enter` | Select entity under cursor |
| `tab` | Cycle through entities of currently selected species |
| `esc` | Deselect |
| `p` | Toggle auto-spawn plants |
| `n` | Toggle NaN debug overlay (shows any non-finite values) |
| `e` | Toggle population chart between count and energy mode |
| `s` | Reseed with a new random seed (with confirmation — resets the sim) |
| `?` | Show help overlay |

### 15.2 Configuration

`src/core/config.ts` exports a `Config` object with default values for every tunable. Live tunables (changeable at runtime without reset):

- Simulation speed (0.1× to 10×) — with NaN guard: if the slider value is non-finite, clamp to 1.0
- Per-species `baseMetabolicRate` (slider in an optional settings panel, not wired up in v1 main UI but the hook is there)
- Poop decay rate (default 0.0)
- Auto-spawn plants toggle — when OFF, *all* plant spawning (including compost-adjacent) is disabled. Existing plants live out their lives and the ecosystem can collapse.

Non-live config (requires reset): world dimensions, total energy, initial species counts, initial genome length range, mutation rates.

### 15.3 Module responsibility

`src/ui/input.ts` owns key handling and selection. `src/core/config.ts` owns the `Config` type and defaults.

---

## 16. Testing strategy

### 16.1 Unit tests

One `.test.ts` file per `src/core/` module (except `sim.ts` which has integration tests). Each tests its module's invariants in isolation:

- `world.test.ts`: wrap-around distance is symmetric; shortest-path is ≤ Euclidean; orientation normalization is idempotent; all angle math is finite
- `energy.test.ts`: `transfer()` preserves total; asserts on NaN inputs; rejects negative amounts; conserves across any sequence of transfers
- `genome.test.ts`: random genome generation is deterministic for a given seed; mutation preserves tape-length bounds; mutation never produces invalid opcodes; stats mutation stays in clamp ranges
- `vm.test.ts`: execution advances `ip` modulo tape length; sense instructions populate `lastSense` correctly (via a mock world); jumps use the correct condition band; turn rate is frame-rate independent; `REPRODUCE` queues a request when eligible and is a no-op when not; plants treat move/turn/reproduce as no-ops
- `sensing.test.ts`: cone angle math is wrap-aware; nearest target is actually nearest (by torus distance); `spread = 1` returns the closest target in any direction; `spread = 0` returns only targets exactly ahead
- `physics.test.ts`: collision detection is symmetric; resolution never leaves overlap; movement respects torus wrap; spatial index returns all neighbors within range
- `metabolism.test.ts`: base cost is deducted every tick; movement cost scales as `a*v + b*v²`; waste buffer fills and triggers deposition at threshold; decomposers drop compost, others drop poop
- `lifecycle.test.ts`: reproduction requires all eligibility conditions; offspring inherits genome and stats with mutation; `maturityAge < lifespan` invariant holds post-mutation; death creates correctly-sized corpse
- `decomposition.test.ts`: decomposer eats corpse at ~50 e/s rate; multiple decomposers share throughput; corpse decays to soil at configured rate
- `plants.test.ts`: plants absorb from soil proportional to rate and compost proximity; compost-adjacent spawning consumes the compost; auto-spawn toggle disables all spawning

### 16.2 Integration tests

`tests/sim.test.ts`:
- Spin up a full sim with a seed and small entity counts, tick for 100 ticks, assert no crashes, all species still alive (or specific expected die-offs)
- Spin up a sim with only plants, tick for 500 ticks, assert plant count stays in a reasonable band
- Spin up a sim with no decomposers, tick for 1000 ticks, assert corpse count grows and soil does not recover
- Spin up a sim with all species, tick for 2000 ticks, assert at least one reproduction has occurred in each species

### 16.3 Invariant fuzz test

`tests/energyConservation.test.ts`:
- For each of 20 seeds, run a full sim for 5000 ticks
- After every single tick, assert `totalEnergy === TOTAL_ENERGY` (within `ENERGY_EPSILON = 1e-6`, see §2.5)
- After every single tick, assert every entity's position, velocity, energy, and wasteBuffer are `Number.isFinite`
- After every single tick, assert every dead-matter item's energy is `Number.isFinite` and non-negative
- **This test gates every commit** via Layer 2.

### 16.4 Runtime guards (not tests, but cheap continuous checks)

In dev mode (`NODE_ENV !== 'production'`):
- After every `transfer()`, assert energy conservation
- At the end of every `tick()`, assert all entity values are finite
- If any assertion fails, throw with a descriptive message naming the offending entity/transfer/tick number

Runtime guards can be disabled with a config flag for performance profiling, but are on by default.

### 16.5 What we are *not* testing

- **UI rendering**: not unit tested. Smoke-tested by hand. The `src/ui/` modules are thin glue; the core has the invariants.
- **Blessed internals**: not our code.
- **Node.js process behavior**: trust the runtime.

### 16.6 Coverage floor

- `src/core/` ≥ 95% line coverage (Layer 2 gate)
- `src/ui/` no floor

### 16.7 Module responsibility

All test files live in `tests/` and import only from `src/core/` (never from `src/ui/`).

---

## 17. Initial seeding

### 17.1 Entity counts (defaults)

Initial energy per entity is taken from `stats.initialEnergy` (see §3.6). The initial seed allocates energy as follows:

| Species | Count | `stats.initialEnergy` | Subtotal |
|---|---|---|---|
| Plants | 250 | 50 | 12,500 |
| Herbivores | 100 | 100 | 10,000 |
| Carnivores | 40 | 200 | 8,000 |
| Decomposers | 50 | 80 | 4,000 |
| **Living total** | | | **34,500** |
| Soil nutrients | | | 65,500 |
| Dead matter at t=0 | | | 0 |
| **Total** | | | **100,000** ✓ |

The soil amount is computed at seed time as `TOTAL_ENERGY − (living total)` — if any count or `initialEnergy` is tuned, soil balances automatically. If the living total exceeds `TOTAL_ENERGY`, initial seeding fails with a config error at startup.

### 17.2 Placement

- Positions: uniformly random in `[0, WORLD_W) × [0, WORLD_H)`.
- Orientations: uniformly random in `[-π, π)` for mobile species; 0 for plants.
- Velocities: zero (the VM will set them on the first tick).
- Ages: uniformly random in `[0, maturityAge)` so the initial population is mixed-age but not yet reproducing (prevents a reproduction spike on tick 1).
- Genomes: random per Section 7.2.
- Lifespan and maturityAge: drawn from normal distributions around the per-species defaults.

### 17.3 Initial collisions

Seeding does not check for initial overlaps. The first physics step resolves them. This is simpler than rejection-sampling and has no lasting effect.

### 17.4 Determinism

The initial state is entirely a function of the seed. `new Sim({ seed: 42 })` always produces the same initial entities in the same positions with the same genomes.

### 17.5 Module responsibility

`src/core/sim.ts` owns initial seeding, delegating to `rng.ts` for all randomness and `lifecycle.ts` for entity construction.

---

## 18. Non-goals and YAGNI

Things this design explicitly does **not** include, and will not include in v1:

- **Save/load**: the sim has no persistence. Restart = reseed.
- **Sexual reproduction**: asexual only. Mate sensing exists but reproduction does not consult it.
- **Multiple world regions / biomes**: one uniform world.
- **Weather, day/night, seasons**: no time-of-day effects.
- **Terrain / obstacles / walls**: open torus, no barriers.
- **Sound**: it's a terminal app. No.
- **Mouse input**: keyboard-only. Blessed supports mouse; we deliberately don't.
- **Multi-player or networking**: local process only.
- **Headless record-and-replay**: not in v1, though the determinism would allow it trivially.
- **Configurable genome opcodes beyond the spec**: the opcode set is fixed.
- **Plant motility**: plants never move, even if mutation would suggest it.
- **Cross-species predation beyond the food chain**: plants→soil, herbivores→plants, carnivores→herbivores, decomposers→dead. No carnivore eating decomposers, etc.

Any of these may become v2 discussions. None are in scope for the first spec cycle.

---

## 19. Glossary

- **Torus topology**: wrap-around in both dimensions; no edges.
- **Energy pool**: one of `{entity, corpse, poop, compost, soil}`; the only places energy can live.
- **Ledger**: the single `transfer(from, to, amount)` function that is the only way energy moves.
- **Waste buffer**: a per-entity sub-field within the `entity` energy pool that holds accumulated metabolic loss and inefficiency waste. When it crosses `POOP_THRESHOLD` during the waste-deposition step, its full value is transferred out as poop (non-decomposers) or compost (decomposers) and the buffer is reset to zero.
- **Genome**: the Turing-tape instruction list that drives an entity's behavior one instruction per tick.
- **IP**: instruction pointer into the genome tape.
- **Tick**: one simulation step at the current speed; base rate 30 Hz.
- **Story**: a unit of work per the workflow doc; one story = one change set committed after full RED/GREEN/PURPLE cycles.

---

## 20. Changelog

- **0.2 — 2026-04-10**: Self-review pass. Fixed plant corpse model (remaining energy, not magic 50). Fixed unified predation ledger (internal wasteBuffer move, not impossible pool-to-subfield transfer). Reconciled carnivore instant-eat with unified model via finite eatRate. Poop/compost contents now reflect full waste buffer at deposition, not just POOP_THRESHOLD. Conditional jumps switched to 4 disjoint bands. Added REPRODUCE as 9th opcode; reproduction is now genome-driven with eligibility gates + cooldown. Added `lastReproTick` to Entity; added `initialEnergy` and `absorbRate` to stats table. Loosened ENERGY_EPSILON to 1e-6. Removed drafting asides. Plant reproduction now exclusively via compost-spawning.
- **0.1 — 2026-04-10**: Initial draft.
