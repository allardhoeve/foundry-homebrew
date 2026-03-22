# Task 019: BDD tests and design doc for results panel

Depends on task-019-gm-agency-results-panel.

## Goal

Add BDD tests covering the results panel behavior and update the design doc to reflect the new GM agency philosophy.

## Background

The results panel changes the encounter roller's core flow. BDD tests verify the visible behavior (panel appears, selection works, posting works). The design doc needs to explain the new philosophy: the GM controls when and what gets communicated.

## Context

- `tests/features/encounter-roller.feature` — existing BDD feature file with assertion + eye tests
- `tests/steps/encounter-roller.steps.js` — existing step definitions
- `docs/scarlet-minotaur-encounter-design.md` — current design doc (describes auto-post philosophy)
- `docs/scarlet-minotaur-random-encounter-check.md` — technical spec

## Changes

### Modified: `tests/features/encounter-roller.feature`

Add scenarios:

**Assertion tests:**
- "Results panel appears when encounter is rolled" — trigger encounter, verify panel is visible with encounter list and action buttons
- "GM can override encounter selection" — trigger encounter, click a different row, verify new row is selected
- "Post to Chat sends selected encounter" — trigger encounter, click "Post to Chat", verify chat message appears
- "Dismiss returns to roller without posting" — trigger encounter, click "Dismiss", verify roller view is restored

**Eye tests:**
- "Results panel eye test" — capture the panel DOM structure (title, info line, encounter list with selected/muted states, action buttons)

### Modified: `tests/steps/encounter-roller.steps.js`

Add step definitions for:
- Triggering an encounter (click the "1 — Roll an encounter now" debug button)
- Verifying results panel is visible (check for encounter list container)
- Clicking an encounter row by index
- Verifying selection state
- Clicking "Post to Chat" / "Dismiss" buttons
- Verifying return to roller view

### Modified: `docs/scarlet-minotaur-encounter-design.md`

Update the Chat Message Philosophy section to describe the new flow:
- Encounters are no longer auto-posted — the GM reviews first
- The results panel gives the GM agency to override, delay, or suppress
- "Post to Chat" preserves the existing atmospheric styling
- "Dismiss" allows the GM to handle the encounter verbally

Update the Personas section:
- DM now has full control over encounter communication
- Players' experience is unchanged (they still see dramatic public messages)

## Tests

The BDD tests in this task *are* the deliverable.

## Verification

```bash
npx playwright test tests/features/encounter-roller.feature
```

## Acceptance criteria

- [ ] All new BDD scenarios pass
- [ ] All existing BDD scenarios still pass
- [ ] Design doc accurately describes the new GM agency flow
- [ ] Eye test captures the results panel DOM structure
