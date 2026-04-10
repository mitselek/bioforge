# Cuvier — PURPLE Scratchpad

## [CHECKPOINT] 2026-04-11 00:37 — Session End (Phases 4-7 Complete)

### Project State
- **Tests:** 406 across 21 test files
- **Source files:** 25 (17 core + 7 UI + main.ts)
- **Fuzz:** 10 seeds x 5000 ticks = 50,000 tick-assertions passing
- **Core simulation:** FEATURE-COMPLETE. Energy conservation proven under fuzz.
- **UI:** Wired but needs PO visual verification and smoke tests
- **ACs:** 142 total across all stories

### Session Summary (Phases 4-7)
- **24 cycles reviewed**, all ACCEPTED (0 rejections)
- **11 refactor commits**, 13 "nothing to refactor" verdicts
- **1 escalation** (lifespan clamp duplication — decision pending from humboldt)

### [GOTCHA] Blessed CJS/ESM Import Bug
`blessed` is a CJS-only package. In the ESM project (`"type": "module"` in package.json), `import * as blessed from 'blessed'` works in `src/ui/layout.ts` (static import), but in `src/main.ts` the lazy conditional require uses `require('blessed')` behind a TTY guard + try/catch. The `@typescript-eslint/no-require-imports` ESLint rule is disabled on that line. This pattern is intentional — blessed crashes if imported when no TTY is available.

### [WIP] Missing UI Smoke Tests
UI modules (theme, worldView, hud, chart, inspector, input, layout) have NO automated tests. They were smoke-verified visually during development. Next session should add:
- Export shape tests (functions exist and return expected types)
- String output tests (renderHud, renderChart, renderInspector return string arrays)
- No-terminal tests (layout.ts can't be tested without blessed mock)

### [WIP] PO Visual Verification Needed
AC7.1.1-6 (main.ts wiring) need PO visual verification:
- Terminal renders correctly (world grid, HUD, chart, inspector panels)
- Key bindings work (space, [, ], q, arrows/hjkl, tab, r)
- Vision cone and sight line render on selected entity
- Speed adjustment is perceptible

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
GREEN tends to insert new functions between an existing JSDoc and its function. Happened 3 times (metabolism.ts, sim.ts x2). Watch for in future reviews.

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
