# Startup — bioforge-dev (*BF:Humboldt*)

**Read this file FIRST on every session start.** It tells you where everything is and what to do, without exploration.

**DO NOT use an Explore agent or broad file search.** This file replaces all of that.

## Working Language

**English.** All communication — user responses, agent messages, commit messages, issues, code comments — is in English.

## This Installation

All paths are derived from two anchors:

| Anchor | How to resolve |
|---|---|
| `REPO` | The git repo root: run `git rev-parse --show-toplevel` or use the working directory |
| `TEAM_DIR` | `$HOME/.claude/teams/bioforge-dev` (runtime, ephemeral) |

| Item | Path |
|---|---|
| Team config repo dir | `$REPO/.claude/teams/bioforge-dev/` |
| Working directory | `$REPO/` |
| Runtime team dir | `$TEAM_DIR/` |
| Roster | `.claude/teams/bioforge-dev/roster.json` (relative to repo) |
| Common prompt | `.claude/teams/bioforge-dev/common-prompt.md` |
| Agent prompts | `.claude/teams/bioforge-dev/prompts/*.md` |
| Scratchpads | `.claude/teams/bioforge-dev/memory/*.md` |
| Source code | `src/core/` (pure sim logic), `src/ui/` (terminal rendering) |
| Entry points | `src/run.ts` (app), `src/main.ts` (blessed wiring) |
| Tests | `tests/*.test.ts` |
| Stories | `stories/` |
| Design spec | `docs/superpowers/specs/2026-04-10-bioforge-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-04-10-bioforge.md` |
| Workflow contract | `docs/WORKFLOW.md` |
| Dev startup script | `scripts/startup.sh` (launches tmux session with claude + 3 agent panes) |

## Read Order

On every session start, read these files in this exact order:

| # | File | Why |
|---|---|---|
| 1 | **This file** (`startup.md`) | Paths, procedures, gotchas |
| 2 | `roster.json` | Team members, models, roles |
| 3 | `common-prompt.md` | Mission, stack, XP pipeline, quality gates |
| 4 | `memory/humboldt.md` | Your prior session's decisions, WIP, warnings |
| 5 | `docs/WORKFLOW.md` | The XP cycle protocol (§3-§9) |

After these 5 reads, you know everything. Zero exploration required.

## Startup Procedure

**Execute these steps in exact order. Do not reorder, skip, or combine steps.**

### Step 1: Sync

```bash
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO" && git pull
```
**Verify:** Output says "Already up to date" or shows pulled changes.

### Step 2: Diagnose

```bash
TEAM_DIR="$HOME/.claude/teams/bioforge-dev"
if [ -d "$TEAM_DIR" ]; then echo "STALE DIR — will clean"; else echo "CLEAN — normal state"; fi
```

The runtime dir is **ephemeral by platform design** — the platform does not preserve it between CLI sessions. A missing dir is the normal state.

### Step 3: Clean

```bash
TEAM_DIR="$HOME/.claude/teams/bioforge-dev"
rm -rf "$TEAM_DIR"
```
**Verify:** `ls "$TEAM_DIR"` returns "No such file or directory".

### Step 4: Create

```
TeamCreate(team_name="bioforge-dev")
```

**Verify (two checks):**
1. TeamCreate returned success with a `team_file_path` and `lead_agent_id`
2. Check disk: `ls "$HOME/.claude/teams/bioforge-dev/config.json"`

**If check 1 succeeds but check 2 fails (config.json not on disk):**
1. `TeamDelete(team_name="bioforge-dev")`
2. `TeamCreate(team_name="bioforge-dev")`
3. Re-check disk for config.json
4. If still fails after 2 attempts — STOP. Ask the user. Do NOT proceed to spawn.

### Step 5: Restore inboxes from repo

```bash
REPO="$(git rev-parse --show-toplevel)"
TEAM_DIR="$HOME/.claude/teams/bioforge-dev"
REPO_INBOXES="$REPO/.claude/teams/bioforge-dev/inboxes"
RUNTIME_INBOXES="$TEAM_DIR/inboxes"

if [ -d "$REPO_INBOXES" ] && [ "$(ls -A "$REPO_INBOXES" 2>/dev/null)" ]; then
    mkdir -p "$RUNTIME_INBOXES"
    cp "$REPO_INBOXES"/*.json "$RUNTIME_INBOXES/" 2>/dev/null
    echo "Restored $(ls "$RUNTIME_INBOXES" | wc -l) inbox(es) from repo"
else
    echo "No repo inboxes found (cold start)"
fi
```

**First session with this startup:** This will print "No repo inboxes found (cold start)" — that's expected.

### Step 6: Validate environment

```bash
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"
node --version          # >= 22
npx tsc --version       # >= 5.6
npx vitest --version    # >= 2.0
npx eslint --version    # >= 9
npx prettier --version  # >= 3
npx lefthook version    # installed
```

All checks are hard gates — every tool must be present and the correct version. If any fail, fix before proceeding.

### Step 7: Verify project health

```bash
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"
npm run typecheck && echo "typecheck: OK" || echo "typecheck: FAIL"
npm run lint && echo "lint: OK" || echo "lint: FAIL"
npm run format:check && echo "format: OK" || echo "format: FAIL"
npm run test && echo "tests: OK" || echo "tests: FAIL"
```

**All four must pass before spawning agents.** If any fail, diagnose and fix (or inform PO) before proceeding. The team must start from a known-good state.

### Step 8: Spawn agents

Ask the user which agents to spawn. Do NOT auto-spawn.

**Available agents (from roster) — each maps to a labeled tmux pane:**

| Name | Role | Color | Model | tmux pane |
|---|---|---|---|---|
| merian | RED (test writer) | red | opus[1m] | pane 1 (RED) |
| linnaeus | GREEN (implementer) | green | opus[1m] | pane 2 (GREEN) |
| cuvier | PURPLE (refactorer) | magenta | opus[1m] | pane 3 (PURPLE) |

**Use `spawn_member.sh`** — do NOT use the Agent tool (it creates new panes instead of reusing existing ones).

**Spawn order: sequential, one at a time. Wait for intro before spawning next.**

```bash
bash scripts/spawn_member.sh --target-pane %1 merian
# wait for intro message
bash scripts/spawn_member.sh --target-pane %2 linnaeus
# wait for intro message
bash scripts/spawn_member.sh --target-pane %3 cuvier
# wait for intro message
```

**What `spawn_member.sh` does:**

1. Reads the agent from `roster.json` (model, color, type)
2. Gets `leadSessionId` from `config.json`
3. Reads the agent's prompt from `prompts/<name>.md`
4. Creates a temp spawn script with `claude --agent-id ... --agent-name ... --team-name ...` flags
5. Sends the script to the target tmux pane via `tmux send-keys`
6. Registers the agent in `config.json` (so messages route correctly)

**Before each spawn:** check `config.json` — if agent name already exists, use SendMessage instead of spawning a duplicate.

**Verify after all spawns:**
1. Each agent sent an intro message
2. `tmux list-panes` still shows exactly 4 panes (no extras)
3. No `name-2` entries in `config.json` (no duplicates)

## Shutdown Procedure

### Step S1: Halt

Stop accepting new work. Let agents finish current tasks.

### Step S2: Own scratchpad + shutdown requests

**S2a.** Write your own scratchpad FIRST to `memory/humboldt.md` with tags: `[DECISION]`, `[WIP]`, `[DEFERRED]`, `[LEARNED]`, `[WARNING]`, `[CHECKPOINT]`.

**S2b.** Send shutdown requests to all agents. Wait for each agent's closing report (`[LEARNED]`, `[DEFERRED]`, `[WARNING]`, `[UNADDRESSED]`).

### Step S3: Collect

Wait for `teammate_terminated` from each agent. Do NOT proceed on `shutdown_approved` alone.

### Step S4: Persist inboxes + commit

```bash
REPO="$(git rev-parse --show-toplevel)"
TEAM_DIR="$HOME/.claude/teams/bioforge-dev"
RUNTIME_INBOXES="$TEAM_DIR/inboxes"
REPO_INBOXES="$REPO/.claude/teams/bioforge-dev/inboxes"

if [ -d "$RUNTIME_INBOXES" ] && [ "$(ls -A "$RUNTIME_INBOXES" 2>/dev/null)" ]; then
    mkdir -p "$REPO_INBOXES"
    cp "$RUNTIME_INBOXES"/*.json "$REPO_INBOXES/"
    echo "Persisted $(ls "$REPO_INBOXES" | wc -l) inbox(es) to repo"
fi

cd "$REPO"
git add .claude/teams/bioforge-dev/memory/
git add .claude/teams/bioforge-dev/inboxes/
git add stories/
```

Then commit with message: `chore: save bioforge-dev session state`

## Architecture Quick Reference

### The Hard Invariant

**Total system energy is constant.** At every tick:

```
sum(living entities) + sum(corpses) + sum(poop) + sum(compost) + soilNutrients == TOTAL_ENERGY
```

All energy movement goes through `src/core/energy.ts` `transfer()`. No energy is ever created or destroyed.

### Architecture Boundary

- `src/core/` is **pure, headless, testable**. No imports from `src/ui/`.
- `src/ui/` depends on `src/core/`. This is the only allowed direction.

### XP Pipeline

```
Humboldt (decomposition) → Merian (RED) → Linnaeus (GREEN) → Cuvier (PURPLE)
```

One acceptance criterion at a time through the full cycle. No shortcuts.

### Quality Gates Summary

| Layer | When | What |
|---|---|---|
| Layer 1 | Phase hand-off | RED/GREEN/PURPLE gates (see WORKFLOW.md §4) |
| Layer 2 | Pre-commit (lefthook) | tsc, eslint, prettier, architecture, purity, type hygiene |
| Layer 3 | Story acceptance | All of Layer 2 + vitest + coverage thresholds |

## Environment Notes

- **Platform:** Linux (Ubuntu)
- **Node:** 22+ (strict ESM — `"type": "module"` in package.json)
- **TypeScript:** 5.x (strict mode — `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Test framework:** Vitest 2.x
- **Pre-commit:** lefthook (tsc + eslint + prettier, NOT vitest — RED commits must contain failing tests)
- **PRNG:** Seeded (no `Math.random` in `src/core/`)
- **Dev server:** `npm run dev` (runs `npx tsx src/run.ts`)

### tmux Layout

The dev session is launched via `scripts/startup.sh` → `tmux-bioforge`. Layout:

```
┌─────────────────────┬─────────────────────┐
│                     │     RED (pane 1)     │
│                     ├─────────────────────┤
│  Humboldt (pane 0)  │    GREEN (pane 2)    │
│  claude --continue  ├─────────────────────┤
│                     │   PURPLE (pane 3)    │
└─────────────────────┴─────────────────────┘
```

| Pane | Label  | Agent    | Role              |
|------|--------|----------|-------------------|
| 0    | —      | humboldt | team lead (you)   |
| 1    | RED    | merian   | test writer       |
| 2    | GREEN  | linnaeus | implementer       |
| 3    | PURPLE | cuvier   | refactorer        |

(*BF:Humboldt*)
