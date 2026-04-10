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
