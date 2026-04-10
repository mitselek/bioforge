# BioForge

Terminal-based ecosystem simulation. Four species — plants, herbivores, carnivores, and decomposers — evolve on a torus-topology 80x30 world under a **hard energy-conservation invariant**. Each creature's behavior is driven by a 9-opcode Turing-tape genome that mutates across generations.

## Quick Start

```bash
npm install
npm run dev        # launch the simulation
```

### Controls

| Key | Action |
|-----|--------|
| `space` | Pause / resume |
| `[` / `]` | Speed down / up |
| `tab` | Cycle to next entity |
| Arrow keys | Move selection cursor |
| `r` | Reset simulation |
| `q` | Quit |

## The Hard Invariant

At every tick, across every operation:

```
sum(living entities) + sum(corpses) + sum(poop) + sum(compost) + soil == TOTAL_ENERGY
```

Energy is never created or destroyed. All movement goes through a central ledger. This invariant is proven by a fuzz test: 10 seeds x 5000 ticks = 50,000 tick-level assertions.

## Architecture

```
src/
├── core/           # Pure simulation logic (16 modules, no UI deps)
│   ├── rng.ts          Seeded deterministic PRNG (mulberry32)
│   ├── clock.ts        Fixed-timestep clock with NaN-guarded speed
│   ├── config.ts       Per-species stats, tunables, validation
│   ├── energy.ts       Central energy ledger with conservation assertions
│   ├── world.ts        Torus geometry (wrap, distance, bearing)
│   ├── entity.ts       Entity type + factory
│   ├── genome.ts       9-opcode instruction set, random generation, mutation
│   ├── deadMatter.ts   Corpse/poop/compost registry with branded IDs
│   ├── physics.ts      Spatial index, movement integration, collisions
│   ├── sensing.ts      Cone-based nearest-target queries
│   ├── vm.ts           Genome VM (one instruction per tick per entity)
│   ├── metabolism.ts   Energy drain + waste dropping
│   ├── lifecycle.ts    Death/corpse creation + reproduction
│   ├── eating.ts       Predation energy transfer
│   ├── decomposition.ts  Decomposer eating + corpse decay
│   ├── plants.ts       Soil absorption + compost-adjacent spawning
│   └── sim.ts          Simulation orchestrator (tick loop)
├── ui/             # Terminal rendering (7 modules, depends on core)
│   ├── theme.ts        Unicode + ASCII glyph themes
│   ├── worldView.ts    World rasterizer
│   ├── hud.ts          Stats panel
│   ├── chart.ts        ASCII sparkline population chart
│   ├── inspector.ts    Selected entity detail panel
│   ├── input.ts        Keyboard bindings
│   └── layout.ts       Blessed screen composition
└── main.ts         # Entry point wiring
```

### Core → UI Boundary

`src/core/` is pure, headless, and fully testable. It has zero imports from `src/ui/`. ESLint enforces this at commit time.

## Species

| Species | Role | Food | Predator | Movement |
|---------|------|------|----------|----------|
| Plant | Producer | Soil (absorption) | Herbivore | Stationary |
| Herbivore | Consumer | Plants | Carnivore | Mobile |
| Carnivore | Apex predator | Herbivores | None | Mobile |
| Decomposer | Recycler | Corpses, poop | None | Mobile |

## Genome

Each entity carries a tape of instructions executed one per tick:

- `MOVE_FORWARD(arg1)` — set velocity
- `TURN_LEFT(arg1)` / `TURN_RIGHT(arg1)` — rotate heading
- `SENSE_FOOD(arg1, arg2)` / `SENSE_PREDATOR` / `SENSE_MATE` — cone query
- `JUMP_IF_TRUE(arg1, target)` / `JUMP_IF_FALSE` — 4-band conditional branch
- `REPRODUCE(arg1)` — request reproduction if eligible

Genomes mutate on reproduction: arg drift, opcode swap, insertion, deletion. Per-species stats also drift lognormally.

## Testing

```bash
npm test              # 406 tests
npm run test:coverage # coverage report (95%+ on src/core/)
```

406 tests across 21 test files. Coverage thresholds: 95% lines/functions/statements, 90% branches on `src/core/`. The energy conservation fuzz test runs 50,000 tick-assertions across 10 seeds.

## Development

```bash
npm run typecheck     # tsc --noEmit (strict mode)
npm run lint          # eslint
npm run format:check  # prettier
```

Pre-commit hooks (lefthook) enforce typecheck + lint + format on every commit.

## Built With

- TypeScript 5 (strict mode + `noUncheckedIndexedAccess`)
- Vitest 2.x
- ESLint 9 + @typescript-eslint
- Prettier 3.x
- Lefthook (pre-commit)
- Blessed (terminal UI)

## Docs

- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — XP pipeline process contract
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — authoritative design spec
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — implementation plan (142/142 ACs complete)

(*BF:Humboldt*)
