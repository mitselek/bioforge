# Linnaeus — GREEN scratchpad

## [CHECKPOINT] 2026-04-11 — Issue #9 config file loader COMPLETE

**State**: 663 tests, 23 test files. Issue #9 done — loadConfigFile + run.ts wired.
**HEAD**: 11f4962 (Cuvier JSDoc cleanup after 3021458)

| AC | Files | Commit | Result |
|----|-------|--------|--------|
| AC1–AC4 | `src/configLoader.ts`, `src/run.ts` | 3021458 | loadConfigFile impl + run.ts wiring |
| PURPLE | `src/configLoader.ts` | 11f4962 | JSDoc stub text removed |

### [GOTCHA] Flaky perf test in physics.test.ts
`physics.test.ts:117` — "handles 1000 entities and 1000 queries in under 100ms" — consistently timing out at ~363ms on this machine. Pre-existing, not caused by any Issue #6–9 work. Confirmed by Cuvier. Humboldt to decide whether to raise the threshold or skip.

---

## [CHECKPOINT] 2026-04-11 — Issue #7 sparklines + controls COMPLETE

**State**: 650 tests, 22 test files. Issue #7 done — sparklines in HUD, renderControls exported.
**HEAD**: 2a76205 (Cuvier accepted, no refactor needed)

| AC | Files | Commit | Result |
|----|-------|--------|--------|
| AC1.2 + AC2.1-3 | `src/ui/hud.ts`, `src/ui/layout.ts`, `src/run.ts` | 2a76205 | sparklines + controls |

### [GOTCHA] Private function duplication when can't export
`chart.ts`'s `sparkline()` is private. Duplicated as `miniSparkline()` in hud.ts — intentional GREEN minimum. Cuvier escalated to Humboldt: if `sparkline` is exported from chart.ts, hud.ts can import it instead.

### [DEFERRED] `renderChart` is dead code
No callers in `src/` after run.ts switched to `renderControls`. Exported but unused. Cuvier noted — Humboldt to decide whether to remove.

---

## [CHECKPOINT] 2026-04-11 — Issue #6 viewport scaling COMPLETE

**State**: 630 tests, 22 test files. Issue #6 done — viewport scaling in rasterize.
**HEAD**: 9321548 (Cuvier's align commit after d091e76)

| AC | Files | Commit | Result |
|----|-------|--------|--------|
| AC1–AC4 | `src/ui/worldView.ts`, `src/run.ts` | d091e76 | viewport params + scaling formula |
| PURPLE | `src/ui/worldView.ts` | 9321548 | selected entity highlight formula aligned |

### [GOTCHA] Two entity-to-cell mapping paths in worldView.ts
Main paint loop and selected-entity highlight must use the SAME formula. In this cycle, I changed the main paint loop to viewport-scaling (`floor(x * gridW / worldW)`) but left the selected-entity highlight using `worldToCell()` (wrap-based: `floor(x) % gridW`). Cuvier caught it. Always check ALL entity→cell conversions in a file when changing the mapping formula.

### [DEFERRED] Cone/sightline at non-1:1 viewport scale
`applyConeOverlay` and `applySightLine` still use `worldToCell` wrap-based math. At viewport != world size they map incorrectly. No test covers this. Flagged by both GREEN and Cuvier. Needs a future issue or AC.

---

## [CHECKPOINT] 2026-04-11 — Layout System Rework COMPLETE

**State**: 615 tests, 22 test files. Layout System Rework story fully done (AC1–AC6).
**HEAD**: 67416d1 (feat(run): wire genome panel + mini HUD + layout apply per frame)

| AC | Files | Commit | Result |
|----|-------|--------|--------|
| AC1 | `src/ui/layouts.ts` | d17524f | LAYOUTS registry + applyLayout |
| AC2 | `src/ui/inspector.ts` | 3fc251d | renderGenome extracted |
| AC3 | `src/ui/layout.ts` | eba5200 | 6 boxes, LAYOUT_1 default |
| AC4 | `src/ui/input.ts`, `src/run.ts` | ae0e5a3 | cycleLayout, l key |
| AC5 | `src/ui/hud.ts` | 3bf8f37 | renderMiniHud |
| AC6 | `src/run.ts` | 67416d1 | full wiring |

### [GOTCHA] JSDoc detachment on insertion
When inserting a new function before an existing one, the existing JSDoc block stays above the new function and detaches from its intended target. Always insert NEW functions AFTER the complete JSDoc+function block of the one above, never between a JSDoc and its function. Cuvier has caught this 4 times (metabolism.ts, sim.ts x2, hud.ts AC5).

### Layout system patterns established
- `BoxLike` local interface avoids blessed import in layouts.ts — pure config module
- `applyLayout` uses explicit `(keyof LayoutConfig)[]` array for iteration — superior to `Object.keys` in strict TS
- String expressions (`'100%-24'`) for dynamic sizing — blessed resolves at render time, no numeric pre-resolution needed
- Hidden panels: `width: 0, height: 0` consistently

---

## [CHECKPOINT] 2026-04-11 — Phase 5 complete

**State**: 385 tests, 20 test files, 50,000 fuzz tick-assertions passing. Core sim feature-complete.
**HEAD**: 3d88054 (fuzz bug fixes — checkWasteDrop overdraw + conservation drift)

### Phase 5 additions

| File | Work done |
|---|---|
| `src/core/sim.ts` | `makeSim` constructor, full 13-step `tick()` loop, `reset()`, `state` snapshot (countsBySpecies, totalEnergy) |
| `src/core/metabolism.ts` | `checkWasteDrop` overdraft fix: clamp to `min(wasteBuffer, ledger.get(entityPool))` |
| `src/core/config.ts` | `energyEpsilon` bumped from `1e-6` to `1e-5` (fuzz drift fix) |

### Key Phase 5 lessons

**sim.ts RNG management**: The passed-in `rng` is used for BOTH seeding and ticking (via `tickRng`). `seedState()` extracts the seeding logic. On `reset()`, a fresh `makeRng(cfg.seed)` is passed to `seedState` and also becomes the new `tickRng`. If seeding rng and tick rng diverge (e.g., by using `makeRng(cfg.seed)` internally while tick still refs the old param), you get hard-to-diagnose overdraw at tick ~870 on seed=100.

**Gaussian lifespan clamp — 3rd instance**: `seedState` in sim.ts is the 3rd instance. Cuvier filed escalation to humboldt. Still unresolved — deferred.

**wasteBuffer partial-drop semantics**: After the overdraft fix, `wasteBuffer -= dropAmount` (not `= 0`). When ledger balance < wasteBuffer, partial waste is dropped and remainder stays in buffer until next tick.

**Ledger epsilon must be wired through cfg**: `makeLedger` accepts `epsilon` opt but sim.ts was using the default `1e-6`. Now passes `cfg.energyEpsilon`. If you add a new ledger construction site, always pass the config epsilon.

---

## [CHECKPOINT] 2026-04-10 — Phase 4 complete

**State**: 340 tests, 17 test files (16 modules + scaffold), 333 passing at end of session.
**HEAD**: 60af4df (plants.ts — applyPlantAbsorption + tryCompostSpawn)

### Modules implemented this phase

| File | Functions | Tests |
|---|---|---|
| `src/core/physics.ts` | `applyMovement`, `applyMovementCost`, `resolveCollisions` | 27 |
| `src/core/metabolism.ts` | `applyMetabolism`, `checkWasteDrop` | 23 |
| `src/core/lifecycle.ts` | `checkDeath`, `processReproduction` | 27 |
| `src/core/eating.ts` | `applyEating` | 11 |
| `src/core/decomposition.ts` | `applyDecomposerEating`, `applyCorpseDecay` | 15 |
| `src/core/plants.ts` | `applyPlantAbsorption`, `tryCompostSpawn` | 18 |

---

## [PATTERN] Established GREEN patterns

### Dual-write invariant
Every energy transfer requires both:
1. `ledger.transfer(from, to, amount)` — keeps ledger balanced
2. `entity.field += amount` / `entity.field -= amount` — keeps struct in sync

The ledger is the source of truth for conservation; the struct field is the cached view.

### `void param` for unused last-position params
ESLint `args: "after-used"` flags trailing unused params. `_prefix` does NOT work for last-position args.
Use `void param` as first statement in body. Applies to: `applyEating` (cfg), `tryCompostSpawn` (deadMatter).

### Zero-guard early return
`if (eaten === 0) return` / `if (actual === 0) return` — skip ledger call when nothing moves.
Consistent across: applyEating, applyDecomposerEating, applyPlantAbsorption (via `if (actual > 0)`).

### Corpse/Poop runtime discrimination
Branded IDs (`CorpseId`, `PoopId`, `CompostId`) are compile-time only — identical at runtime.
When a function takes `Corpse | Poop`, caller must pass `targetPool: EnergyPool` explicitly.
See: `applyDecomposerEating` — caller constructs `{ kind: 'corpse', id: corpse.id }`.

### Gaussian lifespan/maturityAge for spawned entities
Both `processReproduction` (lifecycle.ts) and `tryCompostSpawn` (plants.ts) use:
```typescript
const lifespan = Math.max(1, rng.gaussian(stats.lifespanMean, stats.lifespanStddev))
const maturityAge = Math.min(
  Math.max(0, rng.gaussian(stats.maturityAgeMean, stats.maturityAgeStddev)),
  lifespan - cfg.minReproWindow - 1,
)
```
This pattern appears twice. If a third instance appears, escalate to humboldt for a shared helper.

### Prettier always needs a pass after edits
Long lines (>80 chars) in lifecycle.ts, physics.ts require `npx prettier --write` before commit.
Pre-commit hook catches it — run `npx prettier --write src/core/<file>.ts` after edits.

---

## [LEARNED] Key discoveries

### Test file read before implementing
Always re-read the test file, not just merian's handoff message. The handoff for decomposition.ts said "5 args" but the actual test had 6 (targetPool as 3rd arg). The test file is ground truth.

### `addCorpse` returns `Corpse | null`
`deadMatter.addCorpse(position, energy)` returns `null` when `energy <= 0`. Tests use:
```typescript
const corpse = registry.addCorpse(...)
if (corpse === null) throw new Error('...')
```
This is a non-obvious type — `addPoop` and `addCompost` always return non-null.

### `tryCompostSpawn` — deadMatter param is caller's responsibility
The function takes `deadMatter: DeadMatterRegistry` but does NOT call `removeCompost`.
Compost removal (when energy reaches 0) is the tick-loop caller's responsibility.
`void deadMatter` suppresses lint.

---

## [DEFERRED] Items for humboldt to decide

### Cross-module duplication: eating model
`applyEating`, `applyDecomposerEating`, `applyMovementCost`, `applyMetabolism` all share the
compute-transfer-deduct pattern. Cuvier flagged this as cross-module scope. No action taken.
If Phase 5 adds a 4th or 5th instance, humboldt should consider a shared helper.

### `deadMatter` param in `tryCompostSpawn`
Currently unused. Spec may intend for the function to also `unregister` the compost pool
from the ledger and call `deadMatter.removeCompost` when fully consumed.
Currently no test covers this. Flagged to humboldt in GREEN handoff.

### Gaussian lifespan clamp helper
Two instances of the lifespan/maturityAge gaussian clamp. Cuvier noted: if a 3rd appears,
escalate to humboldt for a shared `randomLifecycleParams(rng, cfg, stats)` helper.
