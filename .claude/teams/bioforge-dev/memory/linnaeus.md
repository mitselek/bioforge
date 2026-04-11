# Linnaeus — GREEN scratchpad

## [CHECKPOINT] 2026-04-11 — Issue #10 probabilistic age-death COMPLETE

**State**: 680 tests, 23 test files. Issue #10 done — probabilistic age-death ramp + defaults + clamping.
**HEAD**: d1aaf49 (defaults 0.2 + clamping follow-up)

| AC | Files | Commit | Result |
|----|-------|--------|--------|
| AC1-AC7 (ramp) | `src/core/lifecycle.ts`, `src/core/sim.ts` | 51cd33c | checkDeath probabilistic ramp |
| config prep | `src/core/config.ts`, `src/core/genome.ts` | d3216f0 | ageDeathVariability field + mutateStats |
| defaults+clamp | `src/core/config.ts`, `src/core/genome.ts`, `src/configLoader.ts` | d1aaf49 | defaults 0.2, clamp [0.05, 0.7] |

### [GOTCHA] ageDeathVariability defaults break old tests
Changing defaults from 0 to 0.2 makes old Story 4.3 tests probabilistic at age=lifespan boundary. `makeRng(1).float()` = 0.627, which fails `< 0.5` check in ramp zone. Merian had to update old tests to use age >= upper bound (1080). Always check ripple effects when changing defaults that affect probabilistic behavior.

### [GOTCHA] configLoader.ts must use `unknown`-first parsing
ESLint `@typescript-eslint/no-unnecessary-condition` fires when you guard `sp.plant !== undefined` because `Record<Species, SpeciesStats>` types all keys as present. But JSON.parse returns untyped data — runtime species may be partial. Solution: parse as `Record<string, unknown>`, process, then cast to `Partial<Config>` at the end.

### [GOTCHA] makeConfig vs loadConfigFile clamping split
Clamping ageDeathVariability in `makeConfig` breaks AC4 (variability=0 backward compat). Clamping only in `loadConfigFile` + `mutateStats` preserves programmatic callers while sanitizing user-file input. This is a deliberate design split.

### [PATTERN] checkDeath now takes 5 params
`checkDeath(entity, rng, ledger, deadMatter, cfg)` — rng is required (non-optional). All call sites (tests + sim.ts) pass rng explicitly.

### [DEFERRED] Magic numbers 0.05 and 0.7
ageDeathVariability clamp bounds appear in genome.ts, configLoader.ts, and tests. Could be named constants. Cuvier noted as acceptable for now.

---

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
Main paint loop and selected-entity highlight must use the SAME formula. Always check ALL entity→cell conversions in a file when changing the mapping formula.

### [DEFERRED] Cone/sightline at non-1:1 viewport scale
`applyConeOverlay` and `applySightLine` still use `worldToCell` wrap-based math. At viewport != world size they map incorrectly. No test covers this.

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
When inserting a new function before an existing one, the existing JSDoc block stays above the new function and detaches from its intended target. Always insert NEW functions AFTER the complete JSDoc+function block of the one above.

---

## [PATTERN] Established GREEN patterns

### Dual-write invariant
Every energy transfer requires both:
1. `ledger.transfer(from, to, amount)` — keeps ledger balanced
2. `entity.field += amount` / `entity.field -= amount` — keeps struct in sync

### Zero-guard early return
`if (eaten === 0) return` / `if (actual === 0) return` — skip ledger call when nothing moves.

### Gaussian lifespan clamp — 3 instances
`processReproduction` (lifecycle.ts), `tryCompostSpawn` (plants.ts), `seedState` (sim.ts). If a 4th appears, escalate to Humboldt for a shared helper.

### Prettier always needs a pass after edits
Long lines require `npx prettier --write` before commit. Pre-commit hook catches it.
