# Task 016b: Light Adjuster BDD Tests

Depends on task-013 (scaffold), task-014 (API integration).
Split from task-016.

## Goal

Implement BDD step definitions and feature files for the Light Adjuster macro. After this task, the Light Adjuster has automated test coverage for its core UI and adjustment functionality.

## Background

Task 016 delivered the light tracker steps and features. The light adjuster is independent and needs its own step definitions and scenarios. This was split out because the work is self-contained.

## Context

- `src/light-adjuster.js` — ApplicationV2; GM-only; adjusts `remainingSecs` on all active lights; registered at `module.api.lightAdjuster`
- `tests/steps/common.steps.js` — shared steps (login, actor light state)
- `tests/steps/light-sources.steps.js` — light source manipulation steps
- `tests/support/fixtures.js` — `session`, `storageStatePaths` fixtures
- `tests/steps/light-tracker.steps.js` — reference for step definition patterns

## Changes

### New: `tests/steps/light-adjuster.steps.js`

Steps specific to the Light Adjuster UI.

**Actions:**
- `When I open the Light Adjuster` — `module.api.lightAdjuster.toggleInterface()` via `page.evaluate()`
- `When I close the Light Adjuster` — same toggle
- `When I adjust light timers by {string}` — click the matching adjustment button (parse "+10 min" / "-1 min" to delta value)

**Assertions:**
- `Then the Light Adjuster should be visible` — assert the app element is visible
- `Then the adjuster status should read {string}` — assert status text
- `Then the timer summary should mention {string}` — assert timers area contains text

### New: `tests/features/light-adjuster.feature`

At least 1 scenario:
- Adjusting timers with active lights shows correct status and summary

## Verification

```bash
npm test
npx playwright test --grep "Light Adjuster"
npm run test:headed
```

## Pitfalls

- **GM-only access** — the Light Adjuster is only available to GMs. Tests must log in as Gamemaster.
- **Active lights required** — adjustment has no effect without active light sources. Scenarios need Given steps that set up actors with active lights.
- **Timer math** — verify the adjustment delta matches what the UI displays. The button `data-delta` values are in seconds.

## Acceptance criteria

- [ ] `tests/steps/light-adjuster.steps.js` defines steps for opening, interacting with, and asserting on the Light Adjuster
- [ ] `tests/features/light-adjuster.feature` has at least 1 scenario
- [ ] All light adjuster feature files pass with `npm test`

## Scope boundaries

- **In scope**: light adjuster step definitions, feature file
- **Out of scope**: exhaustive scenario coverage, CI/CD
- **Do not** modify existing module source code (`src/`, `styles/`)
