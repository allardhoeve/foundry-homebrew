# Task 064: Unify party state sync

Depends on task-063.

## Goal

Merge the separate party light/sight and ownership sync functions into one unified `syncPartyState` that resolves member actors once and applies all state (light, sight, ownership) in one pass.

## Background

The current implementation has `syncPartyLight` and `syncPartyOwnership` as separate functions that each resolve member actors independently. On actor update (member added/removed), both are called separately and can race. A single function is simpler, avoids duplicate member resolution, and prevents race conditions.

Ownership only changes on member add/remove (actor update), not on item changes. But running `computePartyOwnership` on every sync is harmless — it's a cheap pure function.

## Context

- `module/src/party-actor.js` — contains `syncPartyLight` (line ~208), `syncPartyOwnership` (line ~269), `syncAllPartyLights` debounce wrapper, and hook registrations
- `module/src/party-ownership.js` — pure `computePartyOwnership` function, already extracted and tested
- `tests/unit/party-ownership.test.js` — unit tests for ownership computation

## Changes

### Modified: `module/src/party-actor.js`

Merge `syncPartyLight` and `syncPartyOwnership` into `syncPartyState`. Resolve member actors once, compute light/sight/ownership, update tokens and actor in one pass. Rename `syncAllPartyLights` → `syncAllPartyState`. Simplify hooks to all call `syncAllPartyState` — no separate ownership call.

### Modified: `module/src/party-actor.js` — light source mapping cache

Replace the mutable `_lightSourceMappings` variable + lazy init with a single `Promise`-based cache. Currently two concurrent `syncPartyState` calls can race and trigger two fetches. Fix:

```js
const _lightSourceMappings = foundry.utils.fetchJsonWithTimeout(
    "systems/shadowdark/assets/mappings/map-light-sources.json"
);
// usage: const mappings = await _lightSourceMappings;
```

Remove `getLightSourceMappings()` function entirely.

### Modified: `tests/unit/party-ownership.test.js`

Add test: "retains ownership when player has two members and one is removed" — two members both owned by same player, remove one, player still has ownership.

## Tests

Extend `tests/unit/party-ownership.test.js`:

- `retains ownership when one of two members from same player is removed`

## Verification

```bash
node --test tests/unit/party-ownership.test.js
```

## Acceptance criteria

- [ ] Single `syncPartyState` function handles light, sight, and ownership
- [ ] Member actors resolved once per sync, not twice
- [ ] All hooks call the same debounced sync function
- [ ] New unit test passes for the two-member-same-player edge case
- [ ] Light source mappings use a `Promise`-based cache (no mutable variable + lazy init)
- [ ] Existing ownership tests still pass
