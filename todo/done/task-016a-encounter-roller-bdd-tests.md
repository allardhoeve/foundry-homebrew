# Task 016a: Encounter Roller BDD Tests

Depends on task-013 (scaffold), task-014 (API integration).
Split from task-016.

## Goal

Implement BDD step definitions and feature files for the Encounter Roller macro. After this task, the Encounter Roller has automated test coverage for its core UI states and interactions.

## Background

Task 016 delivered the light tracker steps and features. The encounter roller is independent and needs its own step definitions and scenarios. This was split out because the work is self-contained.

## Context

- `module/src/scarlet-minotaur-encounter.js` — ApplicationV2; roll mode picker, encounter check, penalty tracking via `game.settings`; registered at `module.api.scarletMinotaurEncounter`
- `tests/steps/common.steps.js` — shared steps (login, actor light state)
- `tests/support/fixtures.js` — `session`, `storageStatePaths` fixtures
- `tests/steps/light-tracker.steps.js` — reference for step definition patterns

## Changes

### New: `tests/steps/encounter-roller.steps.js`

Steps specific to the Encounter Roller UI.

**Actions:**
- `When I open the Encounter Roller` — `module.api.scarletMinotaurEncounter.toggleInterface()` via `page.evaluate()`
- `When I close the Encounter Roller` — same toggle
- `When I select roll mode {string}` — click the matching mode picker option
- `When I force an encounter` — click the force encounter button (`1d1` for deterministic result)

**Assertions:**
- `Then the Encounter Roller should be visible` — assert the app element is visible
- `Then the Encounter Roller should show the roll mode picker` — assert picker is visible
- `Then the Encounter Roller should show the roller` — assert button grid is visible
- `Then the encounter penalty display should show {int}` — assert penalty value

### Modified: `tests/steps/common.steps.js`

Add settings steps if not already present:
- `Given the Minotaur penalty is {int}` — `game.settings.set()` via `page.evaluate()`
- `Given the encounter roll mode is {string}` — `game.settings.set()` via `page.evaluate()`

### New: `tests/features/encounter-roller.feature`

At least 2 scenarios:
- Roller opens with correct initial state (mode picker visible, penalty at expected value)
- Forcing an encounter produces deterministic UI result

**Note:** No whisper assertions for now — only test deterministic UI state and public chat messages. Whisper testing deferred until we have a good plan for identifying which whisper to assert on.

## Verification

```bash
npm test
npx playwright test --grep "Encounter Roller"
npm run test:headed
```

## Pitfalls

- **Encounter roller randomness** — normal/noise rolls are random. Only "force encounter" (`1d1`) gives deterministic results. Use forced encounters for assertions.
- **Chat message assertions** — chat messages are async. Steps may need to poll for the message to appear in the DOM.
- **Settings reset** — ensure encounter settings are reset between scenarios to prevent cross-scenario contamination (follow pattern from light tracker Before hooks).

## Acceptance criteria

- [ ] `tests/steps/encounter-roller.steps.js` defines steps for opening, interacting with, and asserting on the Encounter Roller
- [ ] `tests/features/encounter-roller.feature` has at least 2 scenarios
- [ ] Settings steps (Minotaur penalty, roll mode) exist in `common.steps.js`
- [ ] All encounter roller feature files pass with `npm test`

## Scope boundaries

- **In scope**: encounter roller step definitions, feature file, settings steps
- **Out of scope**: whisper assertions, exhaustive scenario coverage, CI/CD
- **Do not** modify existing module source code (`module/src/`, `module/styles/`)
