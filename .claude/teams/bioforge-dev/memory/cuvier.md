# Cuvier — PURPLE Scratchpad

## [CHECKPOINT] 2026-04-11 11:15 — Session End (Layout System Rework Complete)

### Project State
- **Tests:** 615 across 22 test files
- **Source files:** 25 (17 core + 7 UI + main.ts) + layouts.ts = 26
- **Fuzz:** 10 seeds x 5000 ticks = 50,000 tick-assertions passing
- **Core simulation:** FEATURE-COMPLETE. Energy conservation proven under fuzz.
- **UI:** Layout system reworked — 4 layouts (LAYOUT_1, LAYOUT_2, LAYOUT_ZEN, LAYOUT_FS), 6 panels, cycling via `l` key. Needs PO visual verification.
- **ACs:** 142 (phases 1-7) + 6 (Layout System Rework) = 148 total

### Session Summary (Layout System Rework — AC1-AC6)
- **6 cycles reviewed**, all ACCEPTED on first pass (0 rejections)
- **1 refactor commit** (AC5: JSDoc reattachment in hud.ts — commit 8fc1fdd)
- **5 "nothing to refactor" verdicts** (AC1, AC2, AC3, AC4, AC6)
- **1 escalation** (pop/chartBox naming mismatch — deferred by humboldt)
- Test count progression: 406 → 555 → 582 → 592 → 601 → 615

### Open Issues for Next Session
- **#6** — Map rescaling to fill panel
- **#7** — Sparklines into HUD + Controls panel

### [GOTCHA] Blessed CJS/ESM Import Bug
`blessed` is a CJS-only package. In the ESM project (`"type": "module"` in package.json), `import * as blessed from 'blessed'` works in `src/ui/layout.ts` (static import), but in `src/main.ts` the lazy conditional require uses `require('blessed')` behind a TTY guard + try/catch. The `@typescript-eslint/no-require-imports` ESLint rule is disabled on that line. This pattern is intentional — blessed crashes if imported when no TTY is available.

### [DEFERRED] pop/chartBox Naming Mismatch
`LayoutConfig` (layouts.ts) uses panel key `pop`. `Layout` (layout.ts) uses field `chartBox`. Bridged via `pop: chartBox` in the boxes mapping. Humboldt deferred this — not blocking but inconsistent. Options: rename chartBox→popBox, rename pop→chart, or accept as-is.

### [DEFERRED] Lifespan/MaturityAge Clamp — 3 Instances (Escalation Pending)
Escalated to humboldt, no decision yet. Locations:
1. `processReproduction` (lifecycle.ts:93-97)
2. `tryCompostSpawn` (plants.ts:74-78)
3. `seedState` in `makeSim` (sim.ts:66-69)
Recommended: extract to entity.ts as `randomLifecycleParams(...)`.

### [DEFERRED] SimState Dead Matter Gap
SimState does not expose dead matter (corpses, compost, poop). Spec §13.2 priority layers 3-5 cannot render. worldView.ts and hud.ts handle this gracefully with soil fallback / zero placeholders. Needs SimState extension.

### [LEARNED] Key Patterns (Accumulated)

**Dual-Write Sub-Accounting Lesson:**
wasteBuffer is an accounting label within the entity pool, not a separate ledger pool. The checkWasteDrop overdraw bug (fixed in Story 5.2) showed that sub-accounting fields must always check the authoritative ledger balance before transferring.

**Epsilon Alignment:**
Ledger epsilon and config energyEpsilon must match. The ledger previously used hardcoded 1e-6; over 5000+ ticks floating-point drift exceeded that. Fixed by passing cfg.energyEpsilon to makeLedger.

**JSDoc Misplacement Pattern:**
GREEN tends to insert new functions between an existing JSDoc and its function. Happened 4 times now (metabolism.ts, sim.ts x2, hud.ts). Watch for in every review.

**`void param` Pattern:**
3 legitimate occurrences (eating.ts, decomposition.ts, plants.ts) + 1 false positive caught and fixed (hud.ts — cfg was actually used). Always verify the parameter IS unused before accepting `void param`.

**Coverage Gap Categories:**
- Category 2 (defense-in-depth guards) is dominant — `if (x === 0) return` zero-amount guards
- physics.ts bIsPlant branch (lines 105-109) — untested due to id ordering in fixture
- sim.ts compost spawning (probability-dependent) — Category 2

### [PATTERN] Review Workflow (Refined)
1. Verify HEAD matches handoff SHA
2. Run ALL gates independently (vitest, tsc, eslint, prettier, coverage)
3. Read implementation + tests + verify against spec/config values
4. Walk bounded-scope checklist: names, extract/inline, duplication, internal types, logic simplification, comments
5. Classify coverage gaps (Cat 1/2/3)
6. For bug fixes: trace root cause → verify fix addresses it → check for similar patterns
7. For UI modules: verify architecture boundary (no core→ui imports), check `import type` usage
8. Commit if refactor needed, or report "nothing to refactor"
9. Send PURPLE_VERDICT to linnaeus, CYCLE_COMPLETE to humboldt

(*BF:Cuvier*)
