# Task 075: Party token keeps its sight without a lit light

Independent of other tasks.

## Goal

The party token is a vision source whether or not a member carries a lit light, so it reveals fog, gives the GM its view when selected, and is visible to the players who observe it.

## Background

`syncPartyState` set `sight.enabled` to "some member has a lit light". On a hex map nobody carries one, so the token had no sight at all. Foundry 14's `Token#_isVisionSource()` returns false for a token without sight, which gave three symptoms on live:

- selecting the party token as GM still showed the whole map
- players got no fog revealed
- players could not see the party token

Hexploration was active on the scene (`HexSightPolygon` backend) and turns a range-0 vision source into a hex, but it only reshapes sources that exist.

The sync runs on every world time change. Shadowdark's real-time light tracking advances world time every second, so turning vision on by hand in the token config was undone within a second.

Ownership was checked and is correct: the Party has All Players None and Observer for each member's player.

## Context

- `module/src/party-actor.js` — the sync, its hooks
- `module/src/party-ownership.js` — unchanged; Observer for owners of current members
- `third_party/hexploration/module/canvas/scene-manager.mjs` — radius 0 becomes one grid cell

## Changes

### New: `module/src/party-vision.js`

**Signature**: `computePartyVision(lights) -> { light, sight }`

**Contract**:
- `sight.enabled` is always true; `sight.range` is the largest bright or dim radius, 0 without lights
- `light` is the light with the furthest reach, widened to the largest bright and dim radius, or `PA_NO_LIGHT` without lights

### Modified: `module/src/party-actor.js`

- Uses `computePartyVision`
- The sync only runs on the active GM; it fires on every client but only the GM may write
- One sync on `ready` repairs tokens saved with sight off

## Tests

Add `tests/unit/party-vision.test.js`: sight stays enabled without lights (regression), no light emitted without lights, furthest-reaching light wins, radii take the maximum.

## Acceptance criteria

- [x] Unit tests pass (`npm run test:unit`, 97 pass)
- [x] On live: selecting the party token as GM shows its view with fog
- [x] On live: players see the party token and their fog is revealed hex by hex

## Scope boundaries

- **Out of scope**: Shadowdark 4.1.0 (unreleased) removes `map-light-sources.json`; light comes from `item.system.light` itself. The sync will then fail on load. Separate task when that release lands.
