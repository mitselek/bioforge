# Merian Scratchpad (*BF:Merian*)

## Session: 2026-04-10

### [CHECKPOINT] 2026-04-10 20:40

Phase 3 complete (220 tests, 11 modules). Phase 4 in progress.

RED commits this session:

- `b258fac` — 4.1 AC1: applyMovement (position integration, torus wrap, velocity reset)
- `62f51e6` — 4.1 AC2: applyMovementCost (drag model, ledger transfer to soil)
- `6af286a` — 4.2 AC1: applyMetabolism (base drain, age++, all species, energy floor)
- `225d7cc` — 4.3 AC1: checkDeath (old-age, starvation, corpse creation, elision)
- `7d50646` — 4.3 AC2: processReproduction (energy split, child entity, parent state reset)

New modules created this session: `src/core/metabolism.ts`, `src/core/lifecycle.ts`

[DECISION] processReproduction signature includes `childId: EntityId` param — sim owns ID
allocation, keeps the function pure.

---

---

### [CHECKPOINT] 2026-04-10 23:55

Phase 4 complete (340 tests, 16 modules). 122/142 ACs done.

RED commits this session:

- `2a26773` — 4.1 AC4.1.2: lastMoveDistance (Entity field + physics pin test)
- `acff15b` — 4.2 AC4+AC5: checkWasteDrop (poop/compost dropping, species discrimination)
- `7a7fa7a` — 4.1 AC4.1.3-6: resolveCollisions (elastic collision stub + 6 RED tests)
- `4041f22` — 4.4 AC4.4.1-4: applyDecomposerEating + applyCorpseDecay (new decomposition.ts)
- `d88716a` — 4.4 AC4.4.1-4: escalation fix — targetPool: EnergyPool param added
- `68f0e04` — 4.4 AC4.4.5-9: applyPlantAbsorption + tryCompostSpawn (new plants.ts)
- `dddeef8` — 4.4 AC4.4.10+4.2.6+4.5.3-5: conservation integration tests (new conservation.test.ts)
- `53ff6f8` — checkpoint scratchpad save

New modules created this session: `src/core/decomposition.ts`, `src/core/plants.ts`

[DECISION] `applyDecomposerEating` takes `targetPool: EnergyPool` as 3rd param — Humboldt-approved. Both `Corpse` and `Poop` branded IDs are compile-time only; no `kind` field exists at runtime. Caller (who iterates the registry) constructs the pool literal and passes it in.

---

### [LEARNED] 2026-04-10 23:55 — Integration test corpse/entity ledger sync

**Never mutate `entity.energy` directly when testing through `checkDeath` / ledger.**

If you need a corpse to be created at energy=N, register a *new* entity at exactly N energy and trigger death via `entity.age = entity.lifespan`. Do not reuse an entity that was set up with a different registered energy and then try to set `entity.energy` by hand — the ledger will reject `unregister` with "cannot unregister non-empty pool."

Pattern that works:
```
const dyingHerb = makeHerbivore(...)
dyingHerb.age = dyingHerb.lifespan        // trigger old-age
dyingHerb.energy = corpseEnergy           // set BEFORE registering
ledger.register({ kind: 'entity', id: dyingHerb.id }, corpseEnergy)
checkDeath(dyingHerb, ledger, ...)         // creates corpse with correct energy
```

---

### [LEARNED] 2026-04-10 23:55 — Integration tests green-on-arrival are valid RED

When Linnaeus had already implemented a function concurrently (e.g., `applyDecomposerEating`), a test written against its spec passed immediately. This is correct — the test still went through RED review and becomes a regression pin. Not every RED commit requires a failing test; what matters is that the test expresses the spec.

---

### [PATTERN] 2026-04-10 23:55 — Deterministic spawn tests with makeConfig overrides

```typescript
const cfgAlwaysSpawn = makeConfig({ plantSpawnBaseProb: 1.0 })   // guaranteed spawn
const cfgNeverSpawn  = makeConfig({ plantSpawnBaseProb: 0 })      // guaranteed no spawn
const cfgNoAuto      = makeConfig({ autoSpawnPlants: false })     // guard branch test
```

Use this pattern whenever a probability gate needs deterministic test coverage without using `Math.random`.

---

### [GOTCHA] 2026-04-10 23:55 — Dead code: `ledger.register` after `checkDeath`

`checkDeath` already calls `ledger.register` for the newly created corpse pool. Adding a second `ledger.register` call for the same corpse in a test helper causes a "duplicate pool" error. Symptom: error thrown inside `checkDeath`, looks like a logic bug, is actually double-registration.

---

### [GOTCHA] 2026-04-10 20:05 — Torus-wrap fixture arithmetic

**Always verify `px + vx*dt > worldW` numerically before committing a wrap test.**

`makeHerbivore(79.9, 15, 1.2, 0)` with `dt=1/30`:

- raw = `79.9 + 1.2*(1/30)` = `79.94` — does NOT cross `worldW=80`
- no wrap occurs; `toBeLessThan(1)` assertion fails even with correct implementation

Fix: use `px=79.99` → raw `80.03` → wraps to `~0.03`. Intent ("near the edge") is not sufficient — compute the sum first.

---

---

### [CHECKPOINT] 2026-04-11 00:01

Phase 5 complete (385 tests + 50,000 fuzz tick-assertions, 17 modules). Core sim feature-complete.

RED commits this session:

- `768c4ec` — 5.1 AC1-3: makeSim constructor, initial state, determinism (new sim.ts + sim.test.ts)
- `ccb4546` — 5.1 AC4-7: tick loop, invariants, 1000-tick crash-free run (Sim interface + assertFinite)
- `f8979f4` — 5.1 AC8-9: state snapshot fields (countsBySpecies, totalEnergy) + sim.reset() stub
- `7cfde38` — 5.2 AC1-5: energy conservation fuzz test (new energyConservation.test.ts)

New modules: `src/core/sim.ts`

[DECISION] `SimState` exposes `countsBySpecies: Readonly<Record<string,number>>` and `totalEnergy: number` computed fresh each call. Not a frozen snapshot — live getter. Intentional: UI layer needs current counts without deep-copying the entities map.

[LEARNED] Fuzz found real drift bug: `tick()` violated conservation at ~1e-6 on some seeds. The ledger's own `assertEnergyConserved()` guard (called inside `tick()`) fires before test assertions run. Linnaeus to fix.

---

### [CHECKPOINT] 2026-04-11 00:33 — Session end

406 tests, 142 ACs, energy conservation proven. All phases complete.

RED commits (Phase 7):
- `3ef6bba` — 7.1 AC1-6: startApp wiring tests (new main.ts stub + main.test.ts, 21 RED)

New modules: `src/main.ts`

[DEFERRED] AC7.1.1-6 awaiting PO visual verification. The 21 main.test.ts tests are RED — Linnaeus has not yet implemented startApp(). Next session: pick up GREEN for 7.1.

[WARNING] blessed CJS/ESM import bug was hit this session (details not captured by Merian — Humboldt/Linnaeus resolved it). If `import * as blessed from 'blessed'` causes issues, check package.json `"type": "module"` and use `import blessed from 'blessed'` or a dynamic import wrapper.

[DEFERRED] UI smoke tests still missing: renderHud, renderInspector, chart sparkline output shape tests. These modules (src/ui/*.ts) have no vitest coverage. A future story should add pure-function tests for the string-output functions (no terminal required — they return string[]).

---

### [LEARNED] 2026-04-10 20:05 — Verify test fixture math before commit

When writing boundary-crossing tests (torus wrap, threshold triggers, etc.), compute the exact numeric outcome of the fixture values. Don't rely on intuition about "close enough to the edge." A quick `node -e` sanity check takes 5 seconds and prevents blocking GREEN.

---

### [CHECKPOINT] 2026-04-11 10:20 — Layout System Rework, AC1 RED

RED commit: `d9a0529` — AC1: LayoutConfig type + LAYOUTS registry + applyLayout
- New files: `tests/ui.test.ts` (149 tests, 146 RED) + `src/ui/layouts.ts` (type stub)
- 21 pre-existing test files still pass (409 tests)

[PATTERN] 2026-04-11 — Stub file for new-module RED tests

When writing RED tests for a module that doesn't exist yet, create a minimal
`src/ui/<module>.ts` stub that:
1. Exports the correct TypeScript types/interfaces (satisfies tsc)
2. Exports the expected symbols with empty/stub implementations (empty object,
   function that throws)
3. Uses `void param` for unused stub parameters (avoids no-unused-vars ESLint)

This keeps tsc and ESLint clean while all assertion-level tests fail RED.

[GOTCHA] 2026-04-11 — `_param` prefix does NOT suppress no-unused-vars in this ESLint config

Despite the convention, `_` prefix on unused params triggers ESLint errors here.
Use `void param` inside the function body instead:
```typescript
export function stub(boxes: T, name: U): void {
  void boxes; void name
  throw new Error('not implemented')
}
```

[GOTCHA] 2026-04-11 — Dynamic `import()` inside try/catch still fails tsc if the path doesn't resolve

Even with a `try { await import('../src/ui/nonexistent.js') } catch {}` pattern,
tsc errors with TS2307 when the file doesn't exist. Solution: create the stub file
first, then write the test file. Order matters.

[PATTERN] 2026-04-11 — Use vitest assert() for type-narrowing on speculative imports

When a function may or may not exist (RED phase, not yet exported), use:
```typescript
import { assert } from 'vitest'
// ...
assert(renderGenome !== undefined, 'renderGenome not yet exported')
const lines = renderGenome(entity) // TypeScript narrowed: no longer undefined
```
This avoids `!` non-null assertions (forbidden) and `as Type` casts (triggers
ESLint non-nullable-type-assertion-style). `assert()` both fails the test with
a clear message AND narrows the type for subsequent calls.

[CHECKPOINT] 2026-04-11 10:30

RED commit: `1fbb5fd` — AC2 genome panel breakout (15 new failing tests)
- 10 tests for renderGenome (not yet exported from inspector.ts)
- 5 tests for renderInspector cleanup (opcodes/IP marker/Genome header must go)
- 6 regression pins for renderInspector summary fields (already pass — correctly)

[CHECKPOINT] 2026-04-11 11:15 — Layout System Rework, AC3–AC5 RED

RED commits:
- `6a1d...` (AC3) — createLayout() returns 6 boxes (miniHudBox + genomeBox added)
- `...` (AC4) — KeyCallbacks.cycleLayout type-level RED + cycling index tests
- `7f2673c` (AC5) — renderMiniHud 14 failing tests

AC5 contract (for Linnaeus):
- `renderMiniHud(simState: SimState): string[]` in `src/ui/hud.ts`
- 4 lines: `P:<n>`, `H:<n>`, `C:<n>`, `D:<n>` — regex `^[PHCD]:\s*\d+$`

AC6 (run.ts wiring) not yet started — awaiting Humboldt TEST_SPEC next session.

Open stories for next session:
- #6 — Map rescaling to fill panel
- #7 — Sparklines into HUD + Controls panel

[PATTERN] 2026-04-11 — vi.mock('blessed') for headless layout tests

```typescript
vi.mock('blessed', () => {
  function makeBox(opts: Record<string, unknown>): Record<string, unknown> { return { ...opts, _type: 'box' } }
  function makeScreen(): Record<string, unknown> { return { _type: 'screen', on: vi.fn(), render: vi.fn() } }
  return { default: { screen: makeScreen, box: makeBox } }
})
// Then dynamic import AFTER mock registration:
const { createLayout } = (await import('../src/ui/layout.js')) as { createLayout: () => Layout6 }
```
vi.mock is hoisted by Vitest transform — registered before any imports execute.

[PATTERN] 2026-04-11 — Type-level RED for interface additions

Use `@ts-expect-error` + a typed helper to force GREEN to add a new field to an interface:
```typescript
function _requireKeyCallbacks(_cb: KeyCallbacks): void { void _cb }
_requireKeyCallbacks({
  // ... all existing fields ...
  // @ts-expect-error — cycleLayout not yet in KeyCallbacks; remove when GREEN adds it
  cycleLayout: () => undefined,
})
```
When GREEN adds the field, tsc fires TS2578 "unused @ts-expect-error directive" — GREEN removes the comment.

[GOTCHA] 2026-04-11 — AC4: `l` key already bound to `cursorRight` in input.ts
Linnaeus must rebind `l` to `cycleLayout` and decide how to handle the former binding.

---

### [CHECKPOINT] 2026-04-11 12:39 — Issue #6 RED complete

RED commit: `bc6603d` — Issue #6: rasterize viewport scaling (8 RED tests)
- 5 tests for AC1 (grid dimensions), 2 for AC3 (2× mapping), 1 for AC4 (priority in shared cell)
- AC2 and AC5 tests pass immediately (backward compat + cell shape already satisfied)
- All 622 pre-existing tests still pass

### [CHECKPOINT] 2026-04-11 12:51 — Issue #7 RED complete

RED commit: `5c3f9c5` — Issue #7: sparklines in HUD + controls panel (13 RED tests)
- AC1.2: 3 RED — renderHud must emit sparkline chars after species count lines
- AC2.1: 3 RED — renderControls not yet exported from hud.ts
- AC2.2: 6 RED — [space]/[r]/[q]/[l] hints + speed display
- AC2.3: 1 RED — chartBox label must be "Controls" not "Population" (layout.ts line 82)
- AC1.1 + AC1.3: 10 already pass (callable + stats fields present)
- All 637 pre-existing tests still pass

[PATTERN] 2026-04-11 — `as unknown as T` cast for incompatible function types in RED

When `as T` on a function triggers TS2352 ("neither type sufficiently overlaps"),
use `as unknown as T` to force the cast. This bypasses the overlap check.
Reserve for RED-phase type stubs only — never in production code.

[GOTCHA] 2026-04-11 — Prettier pre-commit hook fires BEFORE vitest

Always run `npx prettier --write tests/ui.test.ts` before committing new test blocks.
The hook runs format-check before typecheck; a format failure kills the commit even if
tsc and eslint pass. Also: `bioforge.config.json` (Humboldt's Issue #8 file) is covered
by the `*.json` glob — always include it in commits if it has unformatted changes.

### [CHECKPOINT] 2026-04-11 15:14 — Issue #9 RED complete

RED commit: `6c65152` — Issue #9: config file loader (11 RED tests)
- New files: `src/configLoader.ts` (stub), `tests/configLoader.test.ts`
- AC1: reads JSON → Partial<Config>; throws on bad JSON
- AC2: makeConfig(loadConfigFile()) produces valid Config
- AC3: missing file returns {} (no crash)
- AC4: JSON overrides propagate (seed:99999 test)
- All 652 pre-existing tests still pass

[PATTERN] 2026-04-11 — Widening function type for RED tests with future params

When a function does not yet accept new optional params, cast it to an extended type:
```typescript
type RasterizeFn = (simState: S, w: number, h: number, theme: T, sel?: number, vW?: number, vH?: number) => Cell[][]
const rasterize: RasterizeFn = rasterizeBase as RasterizeFn
```
TypeScript allows assigning a narrower function to a wider optional-params type, but ESLint
`no-unnecessary-type-assertion` may still fire if TS considers the assignment valid. Use
`as RasterizeFn` explicitly — it avoids `@ts-expect-error` and passes both tsc and ESLint.

---

### [WIP] 2026-04-11 12:24 — Issue #6 RED in progress (interrupted by /exit)

Received TEST_SPEC from Humboldt for Issue #6 (map rescaling). Acknowledged all 5 ACs. Had NOT yet written any test code — interrupted immediately after acknowledgment.

Test target: `tests/ui.test.ts` (append new describe blocks)
Function under test: `rasterize` in `src/ui/worldView.ts`

Current signature:
```typescript
export function rasterize(
  simState: SimState,
  worldW: number,
  worldH: number,
  theme: Theme,
  selectedId?: number,
): Cell[][]
```

New signature (GREEN must implement):
```typescript
export function rasterize(
  simState: SimState,
  worldW: number,
  worldH: number,
  theme: Theme,
  selectedId?: number,
  viewportW?: number,
  viewportH?: number,
): Cell[][]
```

ACs to test:
1. Returns grid of exactly viewportH rows × viewportW cols
2. viewportW=80, viewportH=30 → same output as before (identity)
3. viewportW=160, viewportH=60 → entity at world(40,15) appears at viewport(80,30) (double scale)
4. viewportW=40, viewportH=15 → priority rendering with shared cells (half scale)
5. Cells have { glyph, color } shape

Key fixture math to verify before writing wrap test:
- world(40,15) at scale 2× → viewport col = floor(40 * 160 / worldW), row = floor(15 * 60 / worldH)
- With worldW=80, worldH=30: col = floor(40*160/80) = 80, row = floor(15*60/30) = 30
- Need to verify entity at world(39,14) → viewport(78,28) at 2× (use slightly off-center to avoid boundary)

(*BF:Merian*)
