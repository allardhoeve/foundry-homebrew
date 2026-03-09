# Task 006: Register player light tracker as module script

Independent of other tasks.

## Goal

Replace the copy-paste hotbar macro workflow with a proper module-registered script. The player light tracker should load automatically via `module.json` and expose a toggle method, so the hotbar macro is a stable one-liner that never needs updating.

## Background

Currently, adding the macro to the Foundry hotbar copies the full script contents into the macro database. This means:
- Code changes require manually re-pasting into the UI
- rsync/deploy doesn't update the running macro
- The Shadowdark system solves this properly: `game.shadowdark.lightSourceTracker.toggleInterface()` — we should follow the same pattern.

## Context

- `macros/player-light-tracker.js` — the full macro source, currently copy-pasted into Foundry's macro UI
- `module.json` — module manifest; needs a script/esmodule entry to auto-load the tracker
- Shadowdark reference: `game.shadowdark.lightSourceTracker` is registered as a singleton on the system namespace

## Changes

### Modified: `module.json`

Add the player light tracker as an ES module or script entry so Foundry loads it on startup.

### Modified: `macros/player-light-tracker.js`

Refactor to:
1. Register the `PlayerLightTrackerApp` class and a singleton instance on the module API (e.g. `game.modules.get("foundry-homebrew").api.lightTracker`)
2. Expose a `toggleInterface()` method

### New: hotbar macro (documentation only)

The hotbar macro becomes:

```js
game.modules.get("foundry-homebrew").api.lightTracker.toggleInterface();
```

## Acceptance criteria

- [ ] Player light tracker loads automatically when the module is active (no manual paste)
- [ ] Hotbar macro is a one-liner toggle call
- [ ] Code changes via rsync/deploy take effect on reload without re-pasting
- [ ] Existing functionality (video transitions, douse, GM debug bar) is preserved

## Scope boundaries

- **In scope**: module registration, singleton pattern, toggle method
- **Out of scope**: changing any visual/functional behavior of the tracker
