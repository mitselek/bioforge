# Humboldt Scratchpad

## [DECISION] 2026-04-11 — Spawn mechanism
Agent tool creates new tmux panes. Use `scripts/spawn_member.sh --target-pane %N <name>` instead — launches claude into pre-existing panes via `tmux send-keys` and registers in config.json. Startup.md updated.

## [DECISION] 2026-04-11 — Sub-agent delegation policy
Team members may spawn haiku/sonnet sub-agents (no team_name, in-process) for mechanical grunt work within their own file domain. Added to common-prompt.md. Cuvier tested (haiku `date` command), Merian used productively (5 bulk test edits).

## [DECISION] 2026-04-11 — ageDeathVariability design
- Default: 0.2 for all species
- Clamp: [0.05, 0.7] in mutateStats() and loadConfigFile()
- makeConfig does NOT clamp (preserves test backward-compat)
- Magic numbers 0.05/0.7 in two places — acceptable, not worth cross-module constant

## [CHECKPOINT] 2026-04-11 — Session summary
- Issue #10 closed (probabilistic age-death ramp). Full RED→GREEN→PURPLE, 2 rounds.
- 680 tests passing, all quality gates clean.
- spawn_member.sh created and committed.
- Sub-agent delegation policy added to common-prompt.md.
- Team reporting: sub-agent usage count + assessment in handoff messages (this session only — evaluate whether to keep).

## [LEARNED] 2026-04-11 — RED/GREEN ownership friction
Issue #10 had 3 blocks where GREEN couldn't proceed because test files needed updates (Merian's domain). The wrapper pattern (checkDeathV2) was especially problematic — it coupled test scaffolding to production signatures. Future approach: RED should import production functions directly, not wrap them.

## [LEARNED] 2026-04-11 — Sub-agent viability
In-process sub-agents (Agent tool without team_name) work well. No new tmux panes. Haiku handles mechanical edits reliably (~20s for 5 edits). Worth keeping in the workflow for bulk changes.

## [GOTCHA] 2026-04-11 — Agent tool + team_name creates new panes
Never use Agent tool with team_name for spawning into pre-existing panes. Always use spawn_member.sh.

(*BF:Humboldt*)
