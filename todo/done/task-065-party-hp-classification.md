# Task 065: Party Actor — fix HP classification to use dead status

Extends task-063. Independent of task-064 (sync unification changes the sync functions; this task changes `_getMemberData` in the sheet).

## Goal

Fix the party sheet HP classification so that "dead" styling is driven by the `dead` status effect, not by HP reaching zero. In Shadowdark, a PC at 0 HP must fail a fortitude save before they are actually dead.

## Background

The current implementation in `_getMemberData` (party-actor.js:128-130) assigns `pa-hp--dead` when `hpFraction <= 0`. This is incorrect: a PC at 0 HP who hasn't failed their save is down but not dead. The "dead" state should come from checking the actor's status effects.

The effects data is already being collected (party-actor.js:124-126) but is only used for rendering effect icons — it doesn't feed into the HP classification.

This was discovered during a test coverage review. The ownership sync logic was already extracted into a pure function (`computePartyOwnership` in `party-ownership.js`) with unit tests. The HP classification should follow the same pattern.

## Context

- `module/src/party-actor.js` — `_getMemberData` contains the inline HP classification logic (lines 128-130) and effects collection (lines 124-126)
- `module/src/party-ownership.js` — example of a pure function extracted for testability
- `tests/unit/party-ownership.test.js` — example of the unit test pattern to follow
- `module/templates/party-sheet.hbs:29` — uses `hpClass` on the HP stat span
- `styles/party-actor.css` — defines `pa-hp--dead` and `pa-hp--damaged` styles

## Changes

### New: `module/src/party-hp.js`

Pure function, no Foundry dependencies.

**Signature**: `computeHpClass(hp, hpMax, statuses)`

- `hp` — current HP (number)
- `hpMax` — maximum HP (number)
- `statuses` — Set of status ID strings from the actor's active effects (e.g. `new Set(["dead"])`)

**Returns**: one of `"pa-hp--dead"`, `"pa-hp--damaged"`, or `""`

**Contract**:
- Has `"dead"` status → `"pa-hp--dead"` (regardless of HP value)
- `hp / hpMax < 0.5` (and not dead) → `"pa-hp--damaged"`
- Otherwise → `""` (healthy)
- Edge: `hpMax <= 0` → treat fraction as 0, so `"pa-hp--damaged"` (unless dead)

### Modified: `module/src/party-actor.js`

- Import `computeHpClass` from `./party-hp.js`
- In `_getMemberData`, collect the set of statuses from the actor's effects and pass it to `computeHpClass` instead of the inline ternary
- Remove the inline `hpClass` ternary (lines 128-130)

## Tests

### New: `tests/unit/party-hp.test.js`

- `dead status applied → pa-hp--dead regardless of HP`
- `full HP, no statuses → empty string`
- `HP below half, no statuses → pa-hp--damaged`
- `HP exactly at half, no statuses → empty string` (boundary: < 0.5, not <=)
- `HP at zero, not dead → pa-hp--damaged` (the key fix)
- `hpMax is zero → pa-hp--damaged` (edge case)
- `dead status with full HP → pa-hp--dead` (status takes precedence)

### Existing: `tests/features/party-actor.feature`

No changes needed — the BDD tests don't assert on HP styling classes.

## Verification

```bash
node --test tests/unit/party-hp.test.js
npx playwright test tests/features/party-actor.feature
```

## Acceptance criteria

- [ ] `computeHpClass` is a pure function in its own file with no Foundry imports
- [ ] Dead styling is driven by the `dead` status, not by HP = 0
- [ ] A PC at 0 HP without the dead status shows as damaged, not dead
- [ ] All unit tests pass
- [ ] All existing BDD tests still pass
