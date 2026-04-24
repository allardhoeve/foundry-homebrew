# Task 066: Extract party actor helper functions

Depends on task-064.

## Goal

Decompose `_getMemberData` and extract a shared `isMember` utility to reduce complexity and eliminate duplicated membership checks.

## Background

`_getMemberData` (party-actor.js:100–142) packs ~7 concerns into one loop body: HP, rations, light sources, active lights, slot usage, effects, and HP classification. Each is simple but they compound — editing one means navigating all the others. The same pattern used for `computeHpClass` (extracted to `party-hp.js`) should be applied to the remaining concerns.

Separately, membership checking is implemented three different ways:
- `PartySheet._registerHooks` has an inline `isMember(actorId)` that checks one party actor
- Module-level `isPartyMember(actorId)` searches all party actors
- `_onDropActor` uses `this.actor.system.members.includes(actor.uuid)` (full UUID)

These should be unified into a single exported helper to prevent drift if the UUID format changes.

## Context

- `module/src/party-actor.js` — main file containing `_getMemberData`, inline `isMember`, and `isPartyMember`
- `module/src/party-hp.js` — existing extracted pure helper (pattern to follow)
- `module/src/party-ownership.js` — existing extracted pure helper (pattern to follow)
- `tests/unit/party-hp.test.js` — existing unit test pattern to follow

## Changes

### New: `module/src/party-members.js`

Extract per-member data functions (pure where possible, like `party-hp.js`):

- `countRations(items)` — filter rations, sum quantities
- `countLightSources(items)` — filter light source items, sum quantities
- `computeSlotStatus(system)` — return `{ used, max, over }`
- `collectEffects(actor)` — return `{ statuses: Set, effects: Array<{name, icon}> }`
- `isMemberOf(memberUuids, actorId)` — single membership check, constructs `Actor.${actorId}` internally

### Modified: `module/src/party-actor.js`

- `_getMemberData` becomes a thin loop that calls the extracted helpers
- Replace inline `isMember` in `_registerHooks` with imported `isMemberOf`
- Replace module-level `isPartyMember` with a version that uses `isMemberOf`
- Replace `includes(actor.uuid)` in `_onDropActor` with `isMemberOf`

## Tests

Add `tests/unit/party-members.test.js`:

- `countRations` — normal items, stashed items, zero quantity, mixed
- `countLightSources` — light source items, non-light items, stashed
- `computeSlotStatus` — under limit, at limit, over limit
- `collectEffects` — suppressed effects excluded, multiple statuses
- `isMemberOf` — match by actorId, no match, empty members list

## Acceptance criteria

- [ ] `_getMemberData` loop body is under 10 lines (calls to helpers)
- [ ] Single `isMemberOf` function used in all three locations
- [ ] All new unit tests pass
- [ ] All existing tests still pass
- [ ] No change to observable sheet behaviour

## Scope boundaries

- **In scope**: Extracting pure helpers, unifying membership checks
- **Out of scope**: V2 sheet migration, changing what data is displayed, modifying syncPartyState (covered by task-064)
