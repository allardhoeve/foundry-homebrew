# Task 002: Player Light Tracker — Douse Flow

Depends on task-001.

## Goal

Implement the full "Douse my flame" interaction: confirmation dialog, socket-aware light toggle, and UI feedback.

## Background

The Shadowdark system already has socket infrastructure for `toggleLightSource` (player → GM). We need to wire the douse button to this, with a confirmation step. Task 001 creates the button; this task makes it fully functional and robust.

## Context

- `macros/player-light-tracker.js` — the scaffold from task 001
- `docs/shadowdark-light-tracker-api.md` — socket events section
- `third_party/foundryvtt-shadowdark/system/src/apps/LightSourceTrackerSD.mjs` — `toggleLightSource()` method
- `third_party/foundryvtt-shadowdark/system/src/documents/ActorSD.mjs` — `yourLightWentOut()`, `turnLightOff()`

## Changes

### Modified: `macros/player-light-tracker.js`

- Confirmation dialog using `foundry.applications.api.DialogV2.confirm()` with thematic text ("Extinguish your light? The darkness waits...")
- On confirm:
  - If GM: call `actor.yourLightWentOut(itemId)` directly + update item
  - If player: emit `toggleLightSource` socket event
- Disable button during the operation to prevent double-clicks
- Handle edge case: light expires between clicking douse and confirming

## Acceptance criteria

- [ ] Confirmation dialog appears with thematic text
- [ ] Canceling does nothing
- [ ] Confirming extinguishes the light for both GM and player users
- [ ] Button is disabled during the operation
- [ ] No error if light expires before confirmation

## Scope boundaries

- **In scope**: douse confirmation, socket integration, edge cases
- **Out of scope**: animations, visual feedback beyond state text change
