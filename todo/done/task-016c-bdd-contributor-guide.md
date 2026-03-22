# Task 016c: BDD Contributor Guide

Depends on task-013 (scaffold), task-014 (API integration).
Split from task-016.

## Goal

Write a practical contributor guide for writing BDD tests so that future work (human or agent) doesn't re-explore the testing infrastructure from scratch.

## Background

The BDD testing infrastructure is now established (tasks 013, 014) and has real usage patterns from the light tracker tests (task 016). The actual implementation diverged from the original plan in important ways (fixture redesign, fixed actors approach). This guide should document what was actually built, not what was originally planned.

## Context

- `tests/support/fixtures.js` — `session` (mutable holder), `storageStatePaths` fixtures
- `tests/support/global-setup.js` — multi-user auth (Gamemaster, Player1, Player2)
- `tests/steps/common.steps.js` — shared login step
- `tests/steps/light-tracker.steps.js` — reference implementation (30+ steps)
- `tests/steps/light-sources.steps.js` — light source manipulation steps
- `tests/features/player-light-tracker.feature` — 33 scenarios, good example of patterns
- `tests/features/actor-visibility.feature` — multi-user test example
- `docs/TESTING.md` — architecture reference

## Changes

### New: `docs/WRITING-TESTS.md`

Practical guide covering:

**How tests are structured:**
- Feature files in `tests/features/` — one per module feature
- Step definitions in `tests/steps/` — `common.steps.js` for shared steps, one file per macro
- All step files import from `tests/support/fixtures.js` and use `createBdd()`

**Fixture pattern (actual implementation):**
- `session` — mutable holder for the active page/context, not the originally planned `foundryPage`
- `storageStatePaths` — per-user storage state files for multi-user tests
- How to switch users within a scenario

**Fixed actors approach:**
- Tests use pre-existing actors in the test world (not created/deleted per scenario)
- Actor light items are modified via `page.evaluate()` calling Foundry's document API
- No actor lifecycle management or cleanup hooks needed
- List the fixed actors available in the test world

**Step organization:**
- Common/game-state steps → `common.steps.js`
- Light source manipulation → `light-sources.steps.js`
- Macro-specific steps → `<macro-name>.steps.js`
- Steps manipulate game state via `page.evaluate()`
- Steps interact with UI via Playwright selectors

**Cross-scenario contamination prevention:**
- How Before hooks reset state (reference commit f11fdf2)
- Pattern for ensuring clean state at scenario start

**Running tests:**
- `npm test` — headless
- `npm run test:headed` — watch the browser
- `npm run test:debug` — Playwright inspector
- Docker must be running first

**Common mistakes to avoid:**
- Don't create/delete actors — use the fixed actors
- Don't manipulate DOM directly for state changes — use `page.evaluate()` with Foundry's API
- Don't put infrastructure concerns (Docker, login, canvas) in step definitions

## Verification

- Guide is readable and accurate
- Code examples in the guide match actual implementation patterns
- A new contributor could write a step definition by following the guide

## Acceptance criteria

- [ ] `docs/WRITING-TESTS.md` exists with practical contributor guidance
- [ ] Documents the actual fixture pattern (`session`, `storageStatePaths`), not the originally planned one
- [ ] Documents the fixed actors approach
- [ ] Documents step organization conventions
- [ ] Includes instructions for running tests

## Scope boundaries

- **In scope**: contributor guide documentation
- **Out of scope**: code changes, new tests
