# BioForge — Team Workflow & Pipeline

*Version 0.1 — 2026-04-10*

This document describes how we build BioForge. It is the process contract between the Product Owner, the team-lead/architect, and the TDD triple. Changes to this document require PO approval.

## 1. Purpose

To turn a simulation spec into working TypeScript code through strict test-first discipline, with clear roles, explicit quality gates, and no unilateral architectural decisions.

## 2. Team

| Role | Who | Responsibilities |
|---|---|---|
| **Product Owner (PO)** | The human user | Owns the spec and stories. Writes acceptance criteria. Accepts or rejects completed work. Final authority on *what* to build. |
| **Lead / Architect / Navigator** | Claude (main session) | Owns the architecture and the spec fidelity. Sequences stories. Reviews every phase hand-off. Handles PURPLE escalations. Coordinates the triple. Relays between PO and triple. |
| **RED** | Agent (spawned) | Writes failing tests. Owns the "describe the desired behavior as a test" phase. |
| **GREEN** | Agent (spawned) | Writes the minimum code to make the failing test pass. Nothing else. |
| **PURPLE** | Agent (spawned) | Refactors green code. Owns clarity and duplication removal, within bounded scope. |

The PO is not an agent. The PO writes stories and accepts work; the PO does not sit in the TDD loop.

## 3. Story lifecycle

### 3.1 Where stories live

- `stories/NN-slug.md` — one markdown file per story, numbered in the order they enter the pipeline
- Each story is also mirrored as a task in the task list (the task is the tracking surface; the file is the source of truth)

### 3.2 Story file template

```markdown
# Story NN — <title>

## Narrative
As a <role> I want <capability> so that <benefit>.

## Acceptance criteria
- [ ] AC1: <testable statement>
- [ ] AC2: <testable statement>
- [ ] AC3: <testable statement>

## Notes / constraints
<design notes, spec references, non-goals>

## Out of scope
<what this story intentionally does not cover>
```

### 3.3 Definition of Ready (story can enter the pipeline)

A story may only be picked up by RED if **all** of these are true:

1. Story file exists at `stories/NN-slug.md`
2. At least one acceptance criterion is written and each criterion is testable (an agent could write an assertion for it)
3. PO has marked the story as "ready" in the task list
4. Lead has sequenced it against dependencies (no blocking stories still open)
5. The relevant spec section is referenced (story links to the part of the design doc it implements)

If any of these are false, the story is "draft" and cannot enter RED.

### 3.4 Flow

```
PO drafts story              -- stories/NN-slug.md
   |
Lead reviews                 -- testability, sequencing, spec alignment
   |
PO marks "Ready"             -- task moves to "ready" bucket
   |
Lead assigns AC1 to RED      -- one acceptance criterion at a time
   |
RED writes failing test      -- Layer 1 RED gates
   |
RED hands to GREEN
   |
GREEN writes minimum code    -- Layer 1 GREEN gates
   |
GREEN hands to PURPLE
   |
PURPLE refactors             -- Layer 1 PURPLE gates + escalation rule
   |
Lead reviews against spec    -- spec fidelity + story intent
   |
Loop for each AC in story
   |
Lead hands story to PO       -- all ACs green, all gates pass
   |
PO accepts or rejects        -- Definition of Done
```

### 3.5 Definition of Done (story can exit the pipeline)

A story is done when **all** of these are true:

1. Every acceptance criterion has at least one test that went RED -> GREEN -> PURPLE
2. All Layer 1 phase gates passed for every test in the story
3. All Layer 2 per-commit gates pass on every commit in the story
4. Lead has reviewed the story's commits against the spec and the story's acceptance criteria
5. PO has explicitly accepted the story in the task list (no implicit acceptance)
6. Task is marked `completed` with references to the commit(s) that closed it

## 4. The TDD cycle (RED -> GREEN -> PURPLE)

One full cycle implements **one** acceptance criterion. Multi-AC stories run multiple cycles sequentially.

### 4.1 RED phase

**Goal**: write a test that expresses the desired behavior and currently fails.

**Gates — RED is done when:**
1. A new test file or new `it()` block exists
2. `npx vitest run` shows the new test *failing with a meaningful assertion error* — not a compile error, not a crash, not a typo
3. The failure message clearly points at the missing behavior
4. All pre-existing tests still pass — RED must not break anything
5. `tsc --noEmit` passes (test code compiles; RED may add minimal type stubs)
6. ESLint passes on all touched files
7. No `any`, no `Math.random`, no `!` non-null assertions in test code
8. Test is deterministic — uses seeded RNG if random draws are involved

**Hand-off**: RED updates the task with "failing test committed as <sha>" and assigns to GREEN.

### 4.2 GREEN phase

**Goal**: make the RED test pass with the minimum viable code.

**Gates — GREEN is done when:**
1. The specific failing test from RED now passes
2. All pre-existing tests still pass
3. `tsc --noEmit` passes under strict config
4. ESLint passes with zero warnings
5. No `any` introduced
6. No `Math.random()` introduced anywhere in `src/core/`
7. No import from `src/ui/` inside `src/core/`
8. **Minimum code change** — GREEN writes the simplest code that passes. No refactoring. No extra abstraction. No premature generalization. No "while I'm here" improvements. If GREEN is tempted to refactor, it's PURPLE's job.
9. Changes are local to the feature under test — no drive-by edits

**Hand-off**: GREEN updates the task with "AC passing as of <sha>" and assigns to PURPLE.

### 4.3 PURPLE phase

**Goal**: improve the code's clarity and structure without changing its behavior.

**Allowed within PURPLE's scope:**
- Rename variables, functions, types within a file
- Extract or inline functions within a module
- Remove duplication within the module being changed
- Tighten internal types
- Improve local clarity and readability
- Simplify logic

**PURPLE must escalate to Lead before:**
- Moving code between modules
- Adding or removing a module/file
- Changing any public export or type consumed by another module
- Touching the `core` <-> `ui` boundary
- Introducing any new dependency
- Any change to the module layout locked in the design
- Anything that feels like "this needs a bigger change"

**Escalation procedure:**
1. PURPLE stops the refactor
2. Writes an escalation note: what it wants to change, why, alternatives considered
3. Sends via task list / message to Lead
4. Lead decides: approve the expanded scope (Lead owns the architectural call), propose a different refactor, or defer to a dedicated refactor story
5. PURPLE does not proceed until Lead has responded

**Gates — PURPLE is done when:**
1. All tests still pass — same count, same behavior
2. `tsc --noEmit` passes
3. ESLint passes with zero warnings
4. **No new features. No new tests. No new files (unless Lead approved).**
5. PURPLE writes a short note in the commit message body explaining what improved
6. Lead reviews the refactor diff before it lands
7. If no refactor is worth doing within PURPLE's bounded scope, PURPLE may deliberately skip refactoring — "nothing to do here" is a valid PURPLE outcome. PURPLE still posts a note to that effect.

**Hand-off**: PURPLE commits (or requests Lead to commit) and returns the AC to Lead for spec review.

## 5. Quality gates

### 5.1 Layer 1 — Phase gates

Enforced by the agent performing the phase and verified by the next agent in the chain. See Section 4.

### 5.2 Layer 2 — Per-commit gates (automated, fast static checks only)

Every commit must pass these checks. Enforced by **lefthook** `pre-commit` hook. Bypassing with `--no-verify` is forbidden per global project standards.

1. `tsc --noEmit` — strict config, zero errors
2. `eslint` — zero warnings
3. `prettier --check` — formatting clean
4. **Architecture check**: no `src/ui/` import from `src/core/` (ESLint `no-restricted-imports`)
5. **Purity check**: no `Math.random` in `src/core/` (ESLint `no-restricted-syntax`)
6. **Type hygiene**: no `any` (`@typescript-eslint/no-explicit-any`)

**Why `vitest run` is NOT a per-commit gate**: strict TDD requires RED commits to contain a failing test by design. Enforcing "all tests pass" at commit time directly conflicts with "commit the failing test first" — the two rules cannot both hold. Moving test execution to Layer 3 (story acceptance) preserves the invariant "every *accepted story* passes all tests" while allowing the RED phase to exist at all.

Developers are still expected to run `npm test` frequently during local development. The hard enforcement point is story acceptance, not individual commits.

### 5.3 Layer 3 — Story gates (Definition of Done)

Enforced by Lead and PO at story acceptance.

Before a story can be accepted, team-lead must verify:

1. `npm run typecheck` — clean
2. `npm run lint` — exit 0
3. `npm run format:check` — exit 0
4. **`npm run test` — all tests pass** (moved here from Layer 2)
5. **`npm run test:coverage` — all coverage thresholds met** (`src/core/` ≥ 95% lines/functions/statements, ≥ 90% branches)
6. **NaN fuzz**: energy conservation fuzz test passes (once implemented in Phase 5 — multiple seeds × 5000 ticks, `Number.isFinite` on every value)
7. Every acceptance criterion for the story has at least one test that went RED → GREEN → PURPLE
8. Team-lead has reviewed the story's commits against the spec
9. PO has explicitly accepted the story (see §3.5 for the full Definition of Done)

The git commit graph for a story will typically show: one or more RED commits with failing tests, one or more GREEN commits restoring all-green, and optional PURPLE refactor commits. The final tip of the story must be all-green; intermediate RED commits are allowed and expected.

## 6. Strict TypeScript enforcement

TypeScript strictness is non-negotiable and enforced at Layer 2. See the design doc (Section D) for the full compiler flags and ESLint rule list. Highlights:

- `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `@typescript-eslint/switch-exhaustiveness-check` — every `Species`, `Opcode`, `EnergyPool`, `DeathCause` switch must be exhaustive
- No `any`, no `!` non-null assertion, no `@ts-ignore`
- `@ts-expect-error` only with a comment explaining why and how to remove it
- All "this is one of N kinds" types are discriminated unions, not string enums

## 7. PURPLE escalation — the architecture guardrail

Stated explicitly as its own rule because it is the most important cultural norm in this project:

**Agents do not get to unilaterally expand the scope of their work.** RED does not get to "while I'm here, fix this other test." GREEN does not get to "I think a small refactor is cleaner." PURPLE does not get to "this really should be a new module." Every scope expansion is an escalation to Lead, who owns the architecture and the spec fidelity.

This rule exists because the triple has narrow, focused mandates, and the only way to keep the sim's hard invariants honest is to prevent creep at every phase.

## 8. Task list conventions

The task list is the coordination surface. Rules:

- **One task per acceptance criterion per phase** — e.g., "Story 3 AC1 RED", "Story 3 AC1 GREEN", "Story 3 AC1 PURPLE", "Story 3 AC1 Lead review"
- **Every task has an owner** — no floating work
- **Tasks reference story files** in their description
- **Hand-off is always explicit** — completing a task unblocks the next one via `blockedBy`
- **Task status transitions**: `pending` -> `in_progress` (agent claims) -> `completed`
- **Blocked work gets a comment explaining why**
- **Stale tasks are not allowed** — Lead sweeps weekly (or per session start)

## 9. Communication protocol

- **Agent <-> Agent**: via task list comments and `SendMessage`. Short, factual, action-oriented.
- **Agent -> Lead (escalation)**: `SendMessage` to Lead with escalation note. Lead responds before agent proceeds.
- **Agent -> PO**: never directly. Agents route to Lead, Lead relays to PO.
- **Lead -> PO**: in the main session, plain-text updates and questions. Lead does not spawn new agents mid-story without PO awareness.
- **Shutdown**: follows the global shutdown protocol — Lead finishes last. Triple agents save WIP to scratchpad before shutdown.

## 10. What this document is not

- Not the spec. The spec lives in `docs/superpowers/specs/2026-04-10-bioforge-design.md` and describes *what* to build. This doc describes *how* we build it.
- Not a user guide for the sim. Player-facing docs are separate.
- Not exhaustive architecture. Module boundaries live in the spec.
- Not immutable. This doc evolves as we learn. Changes require PO approval and a note in the changelog at the bottom.

## Changelog

- **0.1 — 2026-04-10**: Initial draft.
