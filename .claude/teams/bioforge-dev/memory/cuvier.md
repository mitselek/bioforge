# Cuvier — PURPLE Scratchpad

## [CHECKPOINT] 2026-04-11 17:55 — Session End (Issue #10 Probabilistic Age-Death)

### Project State
- **Tests:** 680 across 23 test files
- **Fuzz:** 10 seeds x 5000 ticks = 50,000 tick-assertions passing
- **Core simulation:** Energy conservation proven under fuzz with probabilistic age-death active (defaults 0.2).

### Session Summary (Issue #10 — Probabilistic Age-Death)
- **2 cycles reviewed**, both ACCEPTED on first pass (0 rejections)
- **0 refactor commits** — both implementations were clean
- Cycle 1: Age-death ramp logic (commit `51cd33c`, 14 new tests, 676 total)
- Cycle 2: Defaults changed to 0.2 + clamping in genome.ts + configLoader.ts (commit `d1aaf49`, 4 new tests, 680 total)

### [LEARNED] Sub-Agent Delegation Policy (2026-04-11)
Established this session. Agent tool without `team_name` runs in-process (no tmux pane). Haiku for simple tasks, sonnet for judgment, never opus. Must report sub-agent usage in handoff messages. Tested successfully with a haiku sub-agent running `date` (2.8s, 27k tokens).

### [LEARNED] ageDeathVariability Design Split (2026-04-11)
`makeConfig` trusts code-level callers (tests need variability=0). `loadConfigFile` and `mutateStats` apply clamping [0.05, 0.7]. Magic numbers 0.05/0.7 in genome.ts and configLoader.ts — not centralized (cross-module = escalation territory).

### [PATTERN] Linnaeus Code Quality
Linnaeus's code has been consistently clean across both Issue #10 handoffs. Both cycles were single-pass ACCEPTs. The `checkDeath` ramp logic, config additions, and genome mutation all followed existing patterns precisely.

### Open Issues for Next Session
- **#6** — Map rescaling to fill panel
- **#7** — Sparklines into HUD + Controls panel

### [DEFERRED] pop/chartBox Naming Mismatch
`LayoutConfig` (layouts.ts) uses panel key `pop`. `Layout` (layout.ts) uses field `chartBox`. Bridged via `pop: chartBox` in the boxes mapping. Humboldt deferred this — not blocking but inconsistent.

### [DEFERRED] Lifespan/MaturityAge Clamp — 3 Instances (Escalation Pending)
Escalated to humboldt, no decision yet. Locations:
1. `processReproduction` (lifecycle.ts:93-97)
2. `tryCompostSpawn` (plants.ts:74-78)
3. `seedState` in `makeSim` (sim.ts:66-69)
Recommended: extract to entity.ts as `randomLifecycleParams(...)`.

### [DEFERRED] SimState Dead Matter Gap
SimState does not expose dead matter (corpses, compost, poop). Spec §13.2 priority layers 3-5 cannot render. Needs SimState extension.

### [GOTCHA] Blessed CJS/ESM Import Bug
`blessed` is CJS-only. In the ESM project, `import * as blessed from 'blessed'` works in `src/ui/layout.ts`, but `src/main.ts` uses `require('blessed')` behind a TTY guard. Intentional — blessed crashes without TTY.

### [PATTERN] Review Workflow (Refined)
1. Verify HEAD matches handoff SHA
2. Run ALL gates independently (vitest, tsc, eslint, prettier, coverage)
3. Read implementation + tests + verify against spec/config values
4. Walk bounded-scope checklist: names, extract/inline, duplication, internal types, logic simplification
5. Commit if refactor needed, or report "nothing to refactor"
6. Send PURPLE_VERDICT to linnaeus, CYCLE_COMPLETE to humboldt
7. Include sub-agent usage report in all handoffs

### [LEARNED] Key Patterns (Accumulated)

**Dual-Write Sub-Accounting:** wasteBuffer is an accounting label within the entity pool, not a separate ledger pool. Sub-accounting fields must always check the authoritative ledger balance before transferring.

**Epsilon Alignment:** Ledger epsilon and config energyEpsilon must match. Fixed by passing cfg.energyEpsilon to makeLedger.

**JSDoc Misplacement:** GREEN tends to insert new functions between an existing JSDoc and its function. Watch for in every review.

**Coverage Gap Categories:** Category 2 (defense-in-depth guards) is dominant — zero-amount guards, probability-dependent branches.

(*BF:Cuvier*)
